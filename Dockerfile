# Prowler Worker Container
# Runs ARQ workers that execute Prowler scans off the backend process.
# This image is intentionally separate from the main backend image so
# Prowler is never installed in the API container.

FROM python:3.12-slim

WORKDIR /app

# System dependencies (curl for healthchecks, gcc/python3-dev for native packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv (same version source as the backend Dockerfile)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock* ./

# Create virtual environment outside /app to avoid being overwritten by the
# volume mount in development (same trick as the backend Dockerfile)
ENV VIRTUAL_ENV=/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN uv venv $VIRTUAL_ENV

# Install project dependencies from lockfile
RUN uv export --frozen --no-dev --no-install-project --format requirements-txt > requirements.txt \
    && uv pip install --python $VIRTUAL_ENV -r requirements.txt \
    && rm requirements.txt

# Install Prowler CLI and ARQ (async task queue)
# Prowler installs the 'prowler' executable into the venv bin
RUN uv pip install --python $VIRTUAL_ENV prowler arq

# Copy backend source code
COPY . .

# Run the ARQ worker; WorkerSettings is defined in the m06 worker module
CMD ["python", "-m", "arq", "modules.m06_cloud_security.worker.WorkerSettings"]
