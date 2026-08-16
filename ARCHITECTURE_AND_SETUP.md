# CloudGuard CSPM — Architecture, Setup, and Production System Design

CloudGuard is a full-stack **Cloud Security Posture Management (CSPM)** platform designed to audit, discover, and remediate multi-account AWS environments. It combines live **AWS Boto3 resource inventory enumeration**, **Prowler 5.x compliance scanning** (CIS, SOC 2, HIPAA, PCI-DSS, NIST 800-53, ISO 27001), and **Groq LLaMA 3.3 AI-driven remediation** for instant, code-ready fixes (CLI, Terraform, and Console steps).

---

## Table of Contents

1. [Local Development & Setup Guide](#1-local-development--setup-guide)
   - [Prerequisites](#prerequisites)
   - [Environment Variables (.env)](#environment-variables-env)
   - [AWS IAM Cross-Account Role Setup](#aws-iam-cross-account-role-setup)
   - [Option A: Running Locally (Native)](#option-a-running-locally-native)
   - [Option B: Running with Docker Compose](#option-b-running-with-docker-compose)
2. [High-Level System Design (HLD)](#2-high-level-system-design-hld)
   - [High-Level Architecture Diagram](#high-level-architecture-diagram)
   - [Core Subsystems & Responsibilities](#core-subsystems--responsibilities)
   - [Cross-Account Authentication & STS AssumeRole Delegation](#cross-account-authentication--sts-assumerole-delegation)
3. [Low-Level System Design (LLD)](#3-low-level-system-design-lld)
   - [Database Entity Relationship Diagram (ERD)](#database-entity-relationship-diagram-erd)
   - [Workflow 1: Account Registration & STS Handshake](#workflow-1-account-registration--sts-handshake)
   - [Workflow 2: Background Prowler Scan & Finding Ingestion](#workflow-2-background-prowler-scan--finding-ingestion)
   - [Workflow 3: Multi-Service Asset Discovery](#workflow-3-multi-service-asset-discovery)
   - [Workflow 4: Groq AI Remediation & Interactive Chat](#workflow-4-groq-ai-remediation--interactive-chat)
   - [Workflow 5: Single-Finding Verification & Rescan](#workflow-5-single-finding-verification--rescan)
4. [Production System Architecture & AWS Integration](#4-production-system-architecture--aws-integration)
   - [Production AWS Architecture Diagram](#production-aws-architecture-diagram)
   - [AWS Native Service Integrations](#aws-native-service-integrations)
   - [Scaling & Performance Strategy](#scaling--performance-strategy)
   - [Production Security & Zero-Trust Posture](#production-security--zero-trust-posture)
   - [CI/CD Deployment Pipeline](#cicd-deployment-pipeline)
   - [Cost & Infrastructure Optimization](#cost--infrastructure-optimization)

---

## 1. Local Development & Setup Guide

### Prerequisites

| Tool | Minimum Version | Purpose |
|---|---|---|
| **Node.js** | 18.x or 20.x | Next.js Frontend & API proxy |
| **Python** | 3.11+ | FastAPI Backend & Prowler runner |
| **PostgreSQL** | 16.x | Relational DB for findings & assets |
| **Redis** | 7.x | STS token cache & background worker queue |
| **Prowler** | 5.x | AWS Compliance auditing engine |
| **AWS CLI** | 2.x | Local AWS credentials & STS execution |
| **Groq API Key** | — | LLaMA 3.3 AI remediation generator |

---

### Environment Variables (`.env`)

Create a `.env` file in the root directory:

```bash
# Database & Cache
DATABASE_URL=postgresql+asyncpg://cspm:password@localhost:5432/cspm
REDIS_URL=redis://localhost:6379/0

# Groq LLM Configuration
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# AWS & Prowler Defaults
AWS_DEFAULT_REGION=ap-south-1
PROWLER_OUTPUT_DIR=/tmp/prowler-output

# Frontend & CORS
NEXT_PUBLIC_API_URL=http://localhost:8000
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

---

### AWS IAM Cross-Account Role Setup

To allow CloudGuard to scan a target AWS account securely:

1. **Create an IAM Role** in the target AWS account named `SentrixCS` (or `CloudGuardScanRole`).
2. **Set the Trust Relationship** to allow the CloudGuard scanner principal with an External ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_SCANNER_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_SHARED_EXTERNAL_ID"
        }
      }
    }
  ]
}
```

3. **Attach AWS Managed Policies**:
   - `arn:aws:iam::aws:policy/SecurityAudit` (Read-only security posture access)
   - `arn:aws:iam::aws:policy/job-function/ViewOnlyAccess` (Inventory discovery)

---

### Option A: Running Locally (Native)

#### 1. Start PostgreSQL & Redis
```bash
# Using Docker for local backing services:
docker run -d --name cspm-postgres -p 5432:5432 -e POSTGRES_DB=cspm -e POSTGRES_USER=cspm -e POSTGRES_PASSWORD=password postgres:16-alpine
docker run -d --name cspm-redis -p 6379:6379 redis:7-alpine
```

#### 2. Install & Start the FastAPI Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run database initialization and start server
PYTHONPATH=. uvicorn main:app --reload --port 8000
```

#### 3. Install & Start the Next.js Frontend
```bash
# In the project root:
npm install
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

### Option B: Running with Docker Compose

To launch the complete platform (Frontend, FastAPI API, ARQ Worker, PostgreSQL, and Redis) in a single command:

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

Check service status:
```bash
docker compose -f docker/docker-compose.yml ps
```

---

## 2. High-Level System Design (HLD)

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client Browser"]
        UI["Next.js 15 App (React 19, Shadcn/UI, Tailwind)"]
    end

    subgraph AppGateway["Frontend Gateway / BFF"]
        Proxy["Next.js Route Proxy (/api/cloud-security/*)"]
    end

    subgraph BackendServices["CloudGuard Core Services (FastAPI)"]
        Router["FastAPI Application Gateway"]
        AccountSvc["Account & Role Manager"]
        DiscoverySvc["Boto3 Resource Enumerator"]
        ProwlerSvc["Prowler 5.x Scanner Runner"]
        GroqSvc["Groq LLM AI Remediation Engine"]
    end

    subgraph DataTier["Data & Cache Tier"]
        PG[(PostgreSQL 16\nFindings, Assets, Accounts, Scans, Remediation Cache)]
        RedisCache[(Redis 7\nSTS Credential Cache & Task Queues)]
    end

    subgraph ExternalAWS["External Target AWS Account"]
        STS["AWS Security Token Service (STS)"]
        AWSResources["AWS Resources\n(EC2, S3, IAM, VPC, RDS, Lambda)"]
    end

    subgraph AIPlatform["AI Cloud"]
        GroqAPI["Groq Cloud API\n(LLaMA-3.3-70B-Versatile)"]
    end

    UI -->|HTTPS / Next.js| Proxy
    Proxy -->|REST API| Router
    Router --> AccountSvc
    Router --> DiscoverySvc
    Router --> ProwlerSvc
    Router --> GroqSvc

    AccountSvc <--> PG
    DiscoverySvc <--> PG
    ProwlerSvc <--> PG
    GroqSvc <--> PG

    AccountSvc <--> RedisCache
    DiscoverySvc <--> RedisCache
    ProwlerSvc <--> RedisCache

    AccountSvc -->|AssumeRole| STS
    DiscoverySvc -->|Boto3 Queries| AWSResources
    ProwlerSvc -->|Prowler CLI Audit| AWSResources
    GroqSvc -->|Inference Stream| GroqAPI
```

---

### Core Subsystems & Responsibilities

#### 1. Next.js 15 Web Application
- **Role**: User-facing security operations console.
- **Tech**: React 19, Shadcn/UI, Tailwind CSS, Recharts.
- **Features**:
  - Global Security Score and Compliance breakdown across 6 frameworks.
  - Multi-account management and real-time scanning status badge.
  - Paginated findings table with search and severity/service filters.
  - Slide-out Remediation Sheet with one-click code copy and interactive chat with Groq.

#### 2. FastAPI Backend Service
- **Role**: RESTful API orchestration, asynchronous task handling, and business logic.
- **Tech**: FastAPI, SQLAlchemy 2.0 (asyncio), Asyncpg, Pydantic v2.
- **Key Modules**:
  - `routers/accounts.py`: Account CRUD, IAM validation, STS connectivity testing.
  - `routers/scans.py`: Trigger full scans or discovery scans, background execution, history retrieval.
  - `routers/findings.py`: Paginated findings query, filtering, single-finding detail, rescan trigger.
  - `routers/resources.py`: Asset inventory querying and service summaries.
  - `routers/stats.py`: Real-time compliance aggregation and dashboard telemetry.
  - `routers/remediation.py`: AI-powered fix generation and interactive contextual chat.

#### 3. Security Discovery & Scanner Subsystem
- **Boto3 Resource Discovery (`services/resource_discovery.py`)**: Parallel multi-service discovery covering S3 buckets, IAM roles/policies, EC2 instances, Security Groups, VPCs, Subnets, and RDS databases.
- **Prowler Compliance Engine (`services/prowler_runner.py`)**: Executes Prowler 5.x CLI as an isolated subprocess, streaming OCSF-compliant findings into PostgreSQL.

#### 4. Groq AI Remediation Subsystem (`services/groq_remediation.py`)
- Leverages `groq.AsyncGroq` with `llama-3.3-70b-versatile`.
- Generates structured Markdown output: Root cause analysis, copy-pasteable AWS CLI commands, production Terraform HCL, AWS Console steps, and CLI verification checks.
- Features dual-layer caching (Redis memory cache + PostgreSQL `remediation_cache` table) to minimize latency and token expenditure.

---

### Cross-Account Authentication & STS AssumeRole Delegation

```mermaid
sequenceDiagram
    autonumber
    participant App as CloudGuard Backend
    participant Redis as Redis Cache
    participant STS as AWS STS (Global)
    participant TargetAWS as Target AWS Account

    App->>Redis: GET sts_credentials:{role_arn}:{external_id}
    alt Cached & Valid (< 50 min old)
        Redis-->>App: Return Temporary Credentials (AccessKey, SecretKey, SessionToken)
    else Expired or Missing
        App->>STS: sts.assume_role(RoleArn, RoleSessionName, ExternalId, DurationSeconds=3600)
        STS->>TargetAWS: Verify Trust Policy & External ID Condition
        TargetAWS-->>STS: Trust Approved
        STS-->>App: Issue Temporary Session Credentials
        App->>Redis: SETEX sts_credentials (TTL: 3000s)
    end
    App->>TargetAWS: Authenticate Boto3 Client / Prowler with Temporary Session
    TargetAWS-->>App: Return Cloud Configurations
```

---

## 3. Low-Level System Design (LLD)

### Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    cloud_accounts ||--o{ cloud_resources : "owns"
    cloud_accounts ||--o{ scans : "has"
    cloud_accounts ||--o{ findings : "has"
    scans ||--o{ findings : "produces"

    cloud_accounts {
        uuid id PK
        varchar_12 account_id UK "AWS Account ID"
        varchar_255 name
        varchar_512 role_arn
        varchar_255 external_id
        varchar_50 environment "production / staging / development"
        varchar_array regions "['ap-south-1', 'us-east-1']"
        varchar_50 status "connected / pending / error"
        timestamp created_at
        timestamp updated_at
    }

    cloud_resources {
        uuid id PK
        varchar_12 account_id FK
        varchar_512 resource_id "ARN or Resource Identifier"
        varchar_100 resource_type "e.g. s3_bucket, ec2_instance"
        varchar_50 service "s3, ec2, iam, vpc, rds"
        varchar_50 region
        jsonb tags
        boolean is_public
        boolean encrypted
        jsonb raw_data
        timestamp last_seen
    }

    scans {
        uuid id PK
        varchar_12 account_id FK
        varchar_50 scan_type "full / resource_only"
        varchar_50 status "running / completed / failed"
        timestamp started_at
        timestamp finished_at
        integer findings_count
        integer resources_scanned
        text error_message
        varchar_100 worker_id
    }

    findings {
        uuid id PK
        varchar_12 account_id FK
        uuid scan_id FK
        varchar_255 check_id "e.g. s3_bucket_public_access"
        varchar_512 resource_id
        varchar_100 resource_type
        varchar_50 service
        varchar_50 region
        varchar_512 title
        varchar_50 status "pass / fail / manual / rescanning"
        varchar_50 severity "critical / high / medium / low / info"
        varchar_100 compliance_type "CIS / SOC2 / NIST / etc."
        text description
        text recommendation
        jsonb compliance "Framework mapping details"
        jsonb remediation "CLI / Terraform / Console steps"
        jsonb raw_data "Prowler event record"
        timestamp updated_at
    }

    remediation_cache {
        uuid id PK
        varchar_255 check_id
        varchar_50 severity
        varchar_50 service
        text ai_response
        varchar_100 model
        integer tokens_used
        timestamp created_at
    }
```

---

### Workflow 1: Account Registration & STS Handshake

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Security Admin
    participant UI as CloudGuard Frontend
    participant API as FastAPI /accounts
    participant DB as PostgreSQL
    participant AWS as AWS STS

    Admin->>UI: Submit (Account ID, Role ARN, Environment, Regions, External ID)
    UI->>API: POST /api/cloud-security/accounts
    API->>AWS: sts.assume_role(RoleArn, ExternalId)
    alt Valid Credentials & Trust Established
        AWS-->>API: Success (Credentials Validated)
        API->>DB: INSERT INTO cloud_accounts (status='connected')
        DB-->>API: Account Saved
        API-->>UI: 201 Created (Account Active)
        UI-->>Admin: Show Success Notification
    else Trust Policy or Role Invalid
        AWS-->>API: 403 AccessDenied
        API->>DB: INSERT INTO cloud_accounts (status='error')
        API-->>UI: 400 Bad Request (Role Assumption Failed)
        UI-->>Admin: Show Trust Policy Fix Guide
    end
```

---

### Workflow 2: Background Prowler Scan & Finding Ingestion

```mermaid
sequenceDiagram
    autonumber
    actor User as Security Engineer
    participant UI as CloudGuard UI
    participant API as FastAPI Backend
    participant Worker as Background Task Worker
    participant Prowler as Prowler 5.x Subprocess
    participant DB as PostgreSQL
    participant Redis as Redis Status

    User->>UI: Click "Start Full Compliance Scan"
    UI->>API: POST /api/cloud-security/scans/{account_id}
    API->>DB: INSERT INTO scans (status='running', started_at=NOW)
    API->>Worker: Dispatch background_scan_task(scan_id, account_id)
    API-->>UI: 202 Accepted (Scan ID returned)
    UI->>UI: Set global scanning banner (pulsing badge)

    Worker->>Prowler: Exec: prowler aws --role {arn} -I {external_id} -f json-ocsf
    Prowler-->>Worker: Stream 150+ Finding Records
    Worker->>DB: Bulk Upsert into `findings` table
    Worker->>DB: UPDATE scans SET status='completed', findings_count=N, finished_at=NOW
    Worker->>Redis: Publish scan_complete event
    UI->>API: Poll GET /scans/{id}/status (every 3s)
    API-->>UI: Status: 'completed'
    UI->>UI: Clear scanning badge & Refresh Dashboard metrics
```

---

### Workflow 3: Multi-Service Asset Discovery

```mermaid
sequenceDiagram
    autonumber
    participant Engine as ResourceDiscoveryService
    participant AWS as AWS APIs (via Boto3)
    participant DB as PostgreSQL

    Engine->>AWS: s3.list_buckets() + get_bucket_encryption() + get_public_access_block()
    Engine->>AWS: ec2.describe_instances() + describe_security_groups() + describe_vpcs()
    Engine->>AWS: iam.list_roles() + list_users() + list_policies()
    Engine->>AWS: rds.describe_db_instances()
    AWS-->>Engine: Raw Resource Metadata
    Engine->>Engine: Normalize tags, public exposure flags, encryption state
    Engine->>DB: Bulk Upsert into `cloud_resources` table
```

---

### Workflow 4: Groq AI Remediation & Interactive Chat

```mermaid
sequenceDiagram
    autonumber
    actor Analyst as Security Analyst
    participant Drawer as RemediationPanel (UI)
    participant API as FastAPI /remediation
    participant Cache as Postgres `remediation_cache`
    participant Groq as Groq LLaMA 3.3 API

    Analyst->>Drawer: Click "Remediate" on Finding
    Drawer->>API: POST /api/cloud-security/remediation/resolve
    API->>Cache: SELECT FROM remediation_cache WHERE check_id = ?
    alt Cache Hit
        Cache-->>API: Return Cached Remediation
        API-->>Drawer: 200 OK (Instant Display)
    else Cache Miss
        API->>Groq: ChatCompletion(system="AWS Security Expert", model="llama-3.3-70b-versatile", prompt=context)
        Groq-->>API: Structured Markdown (CLI, Terraform, Console, Verification)
        API->>Cache: INSERT INTO remediation_cache
        API-->>Drawer: 200 OK
    end
    Drawer-->>Analyst: Render Syntax-Highlighted Steps & Copy Buttons

    Analyst->>Drawer: "How do I apply this to a Terraform module?"
    Drawer->>API: POST /api/cloud-security/remediation/chat
    API->>Groq: ChatCompletion(history=[user, assistant, new_question])
    Groq-->>API: Tailored Follow-up Answer
    API-->>Drawer: Return Reply
```

---

### Workflow 5: Single-Finding Verification & Rescan

```mermaid
sequenceDiagram
    autonumber
    actor Engineer as DevOps Engineer
    participant Drawer as RemediationPanel
    participant API as FastAPI /findings/{id}/rescan
    participant Scanner as Targeted Check Runner
    participant DB as PostgreSQL

    Engineer->>Drawer: Click "Verify Fix & Rescan"
    Drawer->>API: POST /api/cloud-security/findings/{id}/rescan
    API->>DB: UPDATE findings SET status='rescanning'
    API->>Scanner: Run targeted Prowler check (--check {check_id})
    alt Fix Verified Successfully
        Scanner-->>API: Status: PASS
        API->>DB: UPDATE findings SET status='pass', updated_at=NOW
        API-->>Drawer: Finding Status: 'pass'
        Drawer-->>Engineer: Show Green Check "Resolved!"
    else Issue Still Present
        Scanner-->>API: Status: FAIL
        API->>DB: UPDATE findings SET status='fail', updated_at=NOW
        API-->>Drawer: Finding Status: 'fail'
        Drawer-->>Engineer: Show Alert "Fix Incomplete"
    end
```

---

## 4. Production System Architecture & AWS Integration

Deploying CloudGuard in a production enterprise environment requires high availability, strict security controls, horizontal scalability, and event-driven automation.

### Production AWS Architecture Diagram

```mermaid
graph TB
    subgraph Users["End Users"]
        Browser["Security Engineers / SREs"]
    end

    subgraph EdgeTier["Edge & Ingress (AWS Cloud)"]
        R53["Route 53 DNS"]
        WAF["AWS WAF (DDoS / Rate Limiting)"]
        CF["CloudFront CDN"]
        ALB["Application Load Balancer"]
    end

    subgraph ComputeTier["Container Compute (AWS ECS Fargate / EKS)"]
        FrontendTasks["Next.js Frontend Tasks\n(2+ Replicas, Auto-scaling)"]
        APITasks["FastAPI Core API Tasks\n(2+ Replicas, Auto-scaling)"]
        WorkerPool["Prowler & Discovery Worker Fleet\n(Scales based on SQS Depth)"]
    end

    subgraph EventMesh["Event-Driven Trigger Mesh"]
        EB["Amazon EventBridge"]
        SQSQueue["Amazon SQS (Scan Job Queue)"]
        DLQ["Amazon SQS (Dead-Letter Queue)"]
        Scheduler["EventBridge Scheduled Rules\n(Nightly / Weekly Scans)"]
    end

    subgraph StorageTier["Data & Security Tier"]
        Aurora[(Amazon Aurora Serverless v2 PostgreSQL\nMulti-AZ, Read Replicas)]
        ElastiCache[(Amazon ElastiCache Redis Cluster\nMulti-AZ)]
        S3Logs[("Amazon S3\nProwler Raw Output & Evidence Artifacts")]
        SecretsMgr["AWS Secrets Manager\n(Database passwords, Groq API keys)"]
        KMS["AWS KMS\n(Customer Managed Encryption Keys)"]
    end

    subgraph TargetAccounts["Target AWS Cloud Accounts"]
        Target1["AWS Production Account (IAM Role: CloudGuardScanRole)"]
        Target2["AWS Staging Account (IAM Role: CloudGuardScanRole)"]
        OrgMgmt["AWS Organizations Management Account\n(StackSet Auto-Onboarding)"]
    end

    Browser --> R53
    R53 --> WAF
    WAF --> CF
    CF --> FrontendTasks
    CF --> ALB
    ALB --> APITasks

    APITasks --> Aurora
    APITasks --> ElastiCache
    APITasks --> SecretsMgr
    APITasks --> SQSQueue

    Scheduler --> EB
    EB --> SQSQueue
    SQSQueue --> WorkerPool
    SQSQueue -.-> DLQ

    WorkerPool --> Aurora
    WorkerPool --> ElastiCache
    WorkerPool --> S3Logs
    WorkerPool --> Target1
    WorkerPool --> Target2

    OrgMgmt -.->|CloudFormation StackSet| Target1
    OrgMgmt -.->|CloudFormation StackSet| Target2
```

---

### AWS Native Service Integrations

#### 1. Real-Time Event-Driven Remediation (EventBridge + CloudTrail)
Instead of waiting for nightly scans, configure Amazon EventBridge rules listening to AWS CloudTrail management events:
- **Event Pattern**: S3 `PutBucketPublicAccessBlock`, IAM `CreateAccessKey`, Security Group `AuthorizeSecurityGroupIngress`.
- **Action**: EventBridge immediately places a micro-audit message on the SQS queue, triggering a targeted single-resource scan within seconds of misconfiguration.

#### 2. Automatic Account Onboarding via AWS Organizations
- Deploy a **CloudFormation StackSet** at the AWS Organizations root.
- Automatically provisions the `CloudGuardScanRole` with the shared External ID in any newly created or invited AWS member account.
- Emits an EventBridge `CreateAccountResult` event that registers the new account in CloudGuard database automatically.

#### 3. AWS Security Hub & Amazon GuardDuty Integration
- **Bidirectional Sync**: Export CloudGuard findings directly to **AWS Security Hub** using the ASFF (AWS Security Finding Format) schema.
- Ingest real-time threat detections from **Amazon GuardDuty** to correlate posture misconfigurations with active network anomalies.

#### 4. Raw Scan Evidence Storage in Amazon S3
- Store full, raw Prowler compliance JSON and HTML evidence reports in an encrypted Amazon S3 bucket with Lifecycle rules (Transition to S3 Glacier after 90 days for compliance audits).

---

### Scaling & Performance Strategy

| Component | Scaling Mechanism | Production Target |
|---|---|---|
| **API Layer** | ECS Fargate CPU/Memory Target Tracking | 50% CPU threshold, 2–10 tasks |
| **Worker Layer** | SQS `ApproximateNumberOfMessagesVisible` Metric | 1 task per 5 queued scans, max 20 |
| **Database** | Aurora Serverless v2 ACU Scaling | 0.5 to 16 ACUs based on connection count |
| **Redis** | ElastiCache Redis Replication Group | 1 Primary + 2 Read Replicas across AZs |
| **Prowler Scans** | Concurrent account chunking | 10 accounts scanned concurrently |

---

### Production Security & Zero-Trust Posture

1. **Least Privilege STS Policies**:
   - The scanner instance role only has permission to call `sts:AssumeRole` on roles with prefix `arn:aws:iam::*:role/CloudGuard*`.
   - External IDs are randomly generated cryptographically secure UUIDs unique to each registered account.
2. **Secrets & Key Management**:
   - Zero plaintext credentials in code or containers.
   - Database credentials and Groq API keys injected via **AWS Secrets Manager** at task startup.
3. **Data Encryption**:
   - In-transit: TLS 1.3 enforced via ALB and CloudFront.
   - At-rest: AES-256 KMS Customer Managed Keys (CMK) for Aurora PostgreSQL, S3, and ElastiCache.
4. **VPC Network Isolation**:
   - Aurora and ElastiCache placed in private, non-routable subnets.
   - ECS Fargate tasks communicate with AWS services via **VPC Endpoints** (PrivateLink for STS, S3, Secrets Manager, SQS).

---

### CI/CD Deployment Pipeline

```mermaid
graph LR
    Push["Git Push to main"] --> Lint["Lint & TypeCheck (npm run build, ruff)"]
    Lint --> Test["Backend Unit & Integration Tests (pytest)"]
    Test --> Build["Build Docker Images (Frontend, API, Worker)"]
    Build --> ECR["Push to Amazon ECR"]
    ECR --> Scan["Container Vulnerability Scan (Amazon Inspector)"]
    Scan --> Deploy["Deploy to ECS Fargate (Rolling Update)"]
```

---

### Cost & Infrastructure Optimization

- **Aurora Serverless v2**: Scales down to 0.5 ACU during quiet hours, reducing database costs by up to 70%.
- **ECS Fargate Spot**: Run Prowler batch scanning workers on Fargate Spot instances for a 70% compute cost reduction.
- **Groq AI Token Caching**: Aggressive two-tier response caching prevents redundant LLM inference calls for identical check findings across accounts.
- **S3 Intelligent-Tiering**: Automated archiving of compliance audit logs and scan artifacts.
