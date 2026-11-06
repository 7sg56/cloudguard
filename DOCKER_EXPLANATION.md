# CloudGuard CSPM: Docker Architecture & Linux Container Systems Guide

This document provides a low-level, technically rigorous breakdown of the containerization and orchestration architecture implemented in CloudGuard CSPM. It is written to address the operational and theoretical criteria evaluated in Linux systems, container runtimes, and distributed infrastructure courses.

---

## 1. Executive Summary & Architecture Diagram

CloudGuard CSPM uses a 5-tier microservices architecture orchestrated through Docker Compose. The system decouples client-side presentation, asynchronous task handling, persistent state, in-memory caching, and backend API routing across isolated container runtimes.

```
+-----------------------------------------------------------------------------------+
|                                     HOST MACHINE                                  |
|                                                                                   |
|  [Browser / Client]                                                               |
|        |                                                                          |
|        | http://localhost:3000                                                    |
|        v                                                                          |
|  +---------------------+                                                          |
|  |  frontend           |                                                          |
|  |  Node 20 Alpine     |                                                          |
|  |  (Next.js 15 Standalone)                                                       |
|  +----------+----------+                                                          |
|             |                                                                     |
|             | Internal Bridge Network (cspm-network)                              |
|             | DNS: http://api:8000                                                |
|             v                                                                     |
|  +---------------------+        Enqueues Scans        +------------------------+  |
|  |  api                | ---------------------------> |  worker                |  |
|  |  Python 3.12-slim   |                              |  Python 3.12-slim      |  |
|  |  (FastAPI / Boto3)  | <--------------------------- |  (ARQ / Prowler Engine)|  |
|  +----------+----------+         Scan Status          +-----------+------------+  |
|             |                                                     |               |
|      +------+---------------------+                +--------------+               |
|      |                            |                |                              |
|      v                            v                v                              |
|  +---------------------+    +---------------------------+                         |
|  |  postgres           |    |  redis                    |                         |
|  |  PostgreSQL 16      |    |  Redis 7                  |                         |
|  |  (Alpine Linux)     |    |  (Alpine Linux)           |                         |
|  +----------+----------+    +-------------+-------------+                         |
|             |                             |                                       |
|             v                             v                                       |
|      Named Volume                  Ephemeral Cache                                |
|      (pgdata)                      (127.0.0.1:6379)                               |
|      Host: 127.0.0.1:5432                                                         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Service Inventory & Topology

| Service Name | Base Image | Role & Primary Process | Exposed Host Port | Internal Network Access |
|---|---|---|---|---|
| **frontend** | `node:20-alpine` (multi-stage) | Next.js 15 SSR & Client Interface (`node server.js`) | `0.0.0.0:3000 -> 3000` | Full `cspm-network` |
| **api** | `python:3.12-slim` (Debian Bookworm) | FastAPI REST Gateway & AWS Inventory (`uvicorn main:app`) | `0.0.0.0:8000 -> 8000` | Full `cspm-network` |
| **worker** | `python:3.12-slim` (Debian Bookworm) | ARQ Task Queue Worker & Prowler CLI Runner (`python -m arq`) | None (isolated) | Full `cspm-network` |
| **postgres** | `postgres:16-alpine` | Relational Storage for Findings, Assets, & Scans | `127.0.0.1:5432 -> 5432` | Full `cspm-network` |
| **redis** | `redis:7-alpine` | Task Queue Broker (ARQ) & STS Token Cache | `127.0.0.1:6379 -> 6379` | Full `cspm-network` |

---

## 3. Dockerfile Technical Deep-Dive

### 3.1 Frontend (`docker/Dockerfile.frontend`): Multi-Stage Build Pipeline

The frontend uses a 4-stage build to isolate build tools from runtime execution, minimizing disk footprint and security exposure.

```dockerfile
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

#### Low-Level Mechanics:
1. **Alpine vs. glibc Compatibility (`libc6-compat`)**:
   - Alpine Linux uses `musl libc` instead of `glibc`.
   - Turbopack and parts of Next.js make native system calls that expect standard GNU C shared objects.
   - `libc6-compat` creates compatibility symlinks (e.g., `/lib/ld-linux-x86-64.so.2`) to prevent dynamic loader crashes (`Error: Dynamic loading not supported`).
2. **Layer Caching Optimization**:
   - Stage `deps` only copies package manifests (`package.json`, `package-lock.json`).
   - If UI code changes in `./app` or `./components`, Docker preserves the cached `deps` layer and skips `npm install`.
3. **Next.js Standalone Mode**:
   - `output: "standalone"` traces import trees and extracts only required dependencies into `.next/standalone`.
   - Monolithic `node_modules` folders (often 800MB+) are discarded; only essential production runtime artifacts are shipped.
4. **Least-Privilege Process Execution**:
   - Standard containers default to `root` (UID 0).
   - In the runner stage, `adduser --system --uid 1001 nextjs` allocates a non-login system user.
   - `USER nextjs` switches execution context away from root. If a remote code execution vulnerability occurs in the Node layer, the attacker is confined to an unprivileged UID with no host write access.

---

### 3.2 Backend API (`docker/Dockerfile.api`): Caching & Python Environment

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

COPY backend/requirements.txt ./

ENV VIRTUAL_ENV=/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN uv venv $VIRTUAL_ENV
RUN uv pip install --python $VIRTUAL_ENV -r requirements.txt
RUN uv pip install --python $VIRTUAL_ENV prowler arq

COPY backend/ .

RUN adduser --system --no-create-home appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Low-Level Mechanics:
1. **Debian Bookworm Minimal (`python:3.12-slim`) vs Alpine**:
   - Python packages such as `cryptography`, `pydantic-core`, and `asyncpg` rely on C extensions.
   - On Alpine (`musl`), these packages must compile from source, requiring large build toolchains (`gcc`, `musl-dev`, `make`) and significantly extending build time.
   - Debian slim provides `glibc` out of the box, allowing pip and uv to pull pre-compiled manylinux binary wheels.
2. **Multi-Stage Tool Injection (`uv`)**:
   - `COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/` pulls the compiled Rust binary directly from Astral's image without installing Rust toolchains via `apt`.
3. **Virtual Environment Isolation outside `/app` (`ENV VIRTUAL_ENV=/venv`)**:
   - In `docker-compose.yml`, the host directory `../backend` is mounted into the container at `/app` for live code updates.
   - If the virtual environment lived at `/app/.venv`, mounting the host directory would shadow the container's installed packages.
   - Setting `VIRTUAL_ENV=/venv` places site-packages on an immutable layer outside the mount path.

---

### 3.3 Asynchronous Worker (`docker/Dockerfile.worker`): Process Decoupling

```dockerfile
FROM python:3.12-slim
WORKDIR /app
# ... dependencies, uv, and venv setup identical to API ...
CMD ["python", "-m", "arq", "worker.WorkerSettings"]
```

#### Architectural Rationale:
- Prowler compliance checks iterate through AWS regions and services using Boto3, spawning multiple subprocesses and consuming heavy CPU/memory.
- Running Prowler directly inside the FastAPI web process would block the Python asyncio event loop and degrade API response times.
- Decoupling the worker into its own container ensures that background tasks are handled in an independent process space without starving the API.

---

## 4. Docker Compose Orchestration Mechanics

File reference: `docker/docker-compose.yml`

### 4.1 Dependency Ordering & Custom Healthchecks

Using standard `depends_on: [postgres]` only waits for the container process to be created, not for the database service to be ready to accept TCP connections. This often results in startup race conditions.

CloudGuard resolves this with native container healthchecks:

```yaml
postgres:
  image: postgres:16-alpine
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U cspm"]
    interval: 3s
    timeout: 3s
    retries: 5

redis:
  image: redis:7-alpine
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 3s
    timeout: 3s
    retries: 5

api:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

- `pg_isready -U cspm` executes directly against PostgreSQL's UNIX domain socket / loopback port.
- `redis-cli ping` sends the standard `PING` command and expects `PONG`.
- The Docker daemon monitors return codes. Until both return code `0` consecutively for configured retries, the `api` container is kept in a waiting state.

---

### 4.2 Network Namespaces & Service Discovery

```yaml
networks:
  cspm-network:
    driver: bridge
```

#### Linux Implementation:
1. Docker creates a virtual software bridge device on the host (e.g., `br-1a2b3c4d5e6f`).
2. Each container receives a virtual ethernet pair (`veth` interface):
   - One peer inside the container's private network namespace as `eth0`.
   - One peer plugged into the host bridge.
3. **Embedded DNS Resolver (`127.0.0.11`)**:
   - Docker intercepts DNS queries on UDP port 53.
   - When the frontend calls `http://api:8000`, the DNS server resolves `api` to the internal bridge IP (e.g., `172.20.0.3`).
   - Hardcoded IP addresses are avoided, supporting horizontal scaling and dynamic IP allocation.

---

### 4.3 Host Port Binding Security: `127.0.0.1` vs `0.0.0.0`

In `docker/docker-compose.yml`:
```yaml
postgres:
  ports:
    - "127.0.0.1:5432:5432"

redis:
  ports:
    - "127.0.0.1:6379:6379"
```

- When Docker maps ports using `"5432:5432"`, it binds to `0.0.0.0` (INADDR_ANY). Docker modifies host `iptables` / `nftables` PREROUTING chains, routing external network traffic directly to the container and bypassing default host firewalls like UFW.
- Binding explicitly to `127.0.0.1:5432` binds the socket to the loopback interface only. External interfaces (LAN, public internet) cannot connect to PostgreSQL or Redis; only host tools and local developers can access them.

---

### 4.4 Storage Subsystems: Named Volumes vs Bind Mounts

#### 1. Named Volume (`pgdata`)
```yaml
volumes:
  pgdata:
# ...
postgres:
  volumes:
    - pgdata:/var/lib/postgresql/data
```
- Managed exclusively by Docker inside `/var/lib/docker/volumes/pgdata/_data`.
- Uses native POSIX filesystem permissions under `postgres:postgres` (UID 70).
- Data persists across container teardowns (`docker compose down`). Data is only removed if the `-v` flag is supplied.

#### 2. Read-Only Bind Mount (`${HOME}/.aws:/root/.aws:ro`)
```yaml
worker:
  volumes:
    - ../backend:/app
    - ${HOME}/.aws:/root/.aws:ro
```
- Mounts the host machine's AWS credential cache directly into the container.
- Appending `:ro` configures a read-only mount at the Linux kernel level via the `MS_RDONLY` flag on the mount syscall. The container cannot mutate, overwrite, or delete host credentials.

---

## 5. Linux Kernel Primitives: Container Theory

Containers are not virtual machines; they are standard Linux processes isolated via kernel features.

### 5.1 Linux Namespaces (Process Isolation)

| Namespace | Linux Flag | What it Isolates in CloudGuard |
|---|---|---|
| **PID** | `CLONE_NEWPID` | The container sees its primary process (e.g., `uvicorn` or `node`) as PID 1. Host processes remain invisible. |
| **NET** | `CLONE_NEWNET` | Container receives its own network stack, loopback interface, routing tables, and private IP. |
| **MNT** | `CLONE_NEWNS` | Filesystem mount points are isolated using `pivot_root`. |
| **UTS** | `CLONE_NEWUTS` | Container sets its own hostname (e.g., `api`, `frontend`, `postgres`). |
| **IPC** | `CLONE_NEWIPC` | Isolates System V IPC and POSIX message queues from other containers. |
| **USER** | `CLONE_NEWUSER` | Maps container UIDs/GIDs to unprivileged host UIDs/GIDs. |

---

### 5.2 Control Groups (cgroups v1 / v2)

Control groups enforce resource constraints on container process trees:
- **Memory (`memory.max`)**: Restricts maximum resident set size (RSS). Exceeding this boundary triggers the kernel Out-Of-Memory (OOM) killer to terminate the container process.
- **CPU (`cpu.cfs_quota_us` and `cpu.cfs_period_us`)**: Enforces Completely Fair Scheduler (CFS) quotas, preventing a compute-heavy scan from starving the host operating system.
- **PIDs (`pids.max`)**: Prevents fork bombs by capping the number of simultaneous threads and processes.

---

### 5.3 Storage Driver: OverlayFS & Copy-on-Write (CoW)

Docker uses the `overlay2` storage driver:
- **LowerDir**: Immutable read-only layers representing base image instructions (`RUN`, `COPY`).
- **UpperDir**: A read-write layer created when the container starts.
- **WorkDir**: An internal directory used for atomic copy operations.
- **MergedDir**: The unified filesystem presented inside the container's mount namespace.

When a process modifies a file belonging to a base image layer, the Linux kernel uses **Copy-on-Write (CoW)** to duplicate the file into `UpperDir` before writing changes. The underlying base image remains unmodified.

---

### 5.4 POSIX Signal Handling & Container Teardown

When running `docker compose down` or `docker stop`:
1. The Docker daemon sends `SIGTERM` (signal 15) to PID 1 inside each container.
2. The application enters graceful shutdown:
   - FastAPI and Uvicorn finish in-flight HTTP requests and close connection pools.
   - ARQ completes or checkpoints active tasks.
   - PostgreSQL flushes write-ahead logs (WAL) to disk.
3. If a container does not terminate within the default grace period (10 seconds), the Docker daemon sends `SIGKILL` (signal 9) for immediate kernel-level termination.

---

## 6. Bash Orchestration Script (`docker-start.sh`)

The repository includes a production management script with POSIX defensive practices.

### Key Shell Engineering Patterns:
```bash
set -euo pipefail
```
- `-e`: Exits immediately if any command returns a non-zero exit code.
- `-u`: Treats undefined variables as fatal errors, preventing accidental variable expansion bugs.
- `-o pipefail`: Propagates pipeline errors. In `cmd1 | cmd2`, if `cmd1` fails, the pipeline returns `cmd1`'s exit code instead of masking it with `cmd2`'s status.

### Docker Environment & Version Checks:
- Runs `docker info` to verify that the Docker daemon socket (`/var/run/docker.sock`) is responsive before issuing commands.
- Dynamically identifies Compose v2 plugin (`docker compose`) versus legacy v1 binary (`docker-compose`).
- Preemptively detects and removes orphan standalone containers (e.g., `cspm-redis`) that could cause port binding conflicts (`bind: address already in use`).

---

## 7. Professor Defense: Technical Q&A Cheat Sheet

### Q1: Why not run both the frontend and backend in a single container?
**Answer**: Combining services in a single container violates the single responsibility principle. It prevents independent horizontal autoscaling, complicates health checks, couples log streams, and requires an init system (like `systemd` or `supervisord`) to handle multiple processes, rather than letting the container engine manage lifecycle signals directly.

### Q2: What is the technical difference between a bind mount and a volume?
**Answer**: 
- A **volume** is allocated and managed by Docker within its storage area (`/var/lib/docker/volumes/`). It guarantees platform-agnostic performance, isolates permissions from host users, and is decoupled from host directory structures.
- A **bind mount** maps an arbitrary file or directory from the host filesystem into the container's mount namespace. It depends on host filesystem layout and permissions, but is ideal for local development hot-reloading.

### Q3: Why is Next.js configured with `standalone` output?
**Answer**: Next.js defaults to packaging all dependencies, including build-time packages. The `standalone` build analyzes the production code paths and outputs a self-contained Node.js server with only the dependencies actually imported at runtime. This reduces the runtime container image footprint by roughly 80-90%.

### Q4: Why is `depends_on: [postgres]` not enough? Why use `condition: service_healthy`?
**Answer**: `depends_on` only verifies that the target container's process has been started (forked). It does not guarantee that the service inside is ready to handle network requests. PostgreSQL requires several seconds to initialize shared memory, replay logs, and open sockets. Using `service_healthy` polls `pg_isready` before starting dependent services, avoiding initialization crashes.

### Q5: What security risk does binding to `0.0.0.0:5432` introduce on Linux?
**Answer**: On Linux hosts running Docker, exposing a port via `0.0.0.0:5432` causes the Docker daemon to write raw `iptables` / `nftables` rules into the `PREROUTING` chain. This exposes the port on all physical and wireless network interfaces, bypassing host-level firewalls such as UFW. Binding explicitly to `127.0.0.1:5432` limits access strictly to the loopback interface.

### Q6: Why did you place the Python virtualenv at `/venv` instead of `/app/.venv`?
**Answer**: In `docker-compose.yml`, the host directory `../backend` is mounted into the container at `/app`. If the virtualenv were inside `/app/.venv`, the host mount would shadow the image's pre-installed packages with the host directory's contents. Keeping `/venv` at the root keeps dependencies isolated in the container filesystem layer.

### Q7: What happens to PostgreSQL data when running `docker compose down` vs `docker compose down -v`?
**Answer**: `docker compose down` removes containers and network interfaces, but preserves named volumes (`pgdata`). Database records remain intact and will be reattached on the next startup. Appending `-v` instructs Docker to delete attached named volumes as well, resulting in a full database reset.
