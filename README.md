# CSPM -- Cloud Security Posture Management

A full-stack cloud security posture management platform built with Next.js, FastAPI, Prowler, and Groq AI.

## Architecture

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: FastAPI, SQLAlchemy 2.0, asyncpg
- **Scanner**: Prowler (AWS security compliance)
- **AI Remediation**: Groq (llama-3.3-70b-versatile)
- **Database**: PostgreSQL 16
- **Queue**: Redis + ARQ (async task queue)
- **Resource Discovery**: boto3 with STS AssumeRole

## Project Structure

```
cspm/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── (dashboard)/        # Dashboard route group
│   │   ├── dashboard/      # Security overview
│   │   ├── findings/       # Compliance findings
│   │   ├── resources/      # Cloud resource inventory
│   │   ├── accounts/       # AWS account management
│   │   └── scans/          # Scan controls
│   └── api/                # API proxy routes
├── components/             # React components
│   ├── ui/                 # Generic UI primitives
│   ├── layout/             # Sidebar, Topbar
│   ├── dashboard/          # Dashboard charts
│   ├── findings/           # Findings table, remediation panel
│   ├── resources/          # Resource table, inventory summary
│   ├── accounts/           # Account cards, add form
│   └── scans/              # Scan controls
├── lib/                    # Shared utilities
├── hooks/                  # Custom React hooks
├── context/                # React Context providers
├── backend/                # FastAPI backend
│   ├── models/             # SQLAlchemy ORM models
│   ├── routers/            # API route handlers
│   ├── services/           # Business logic
│   └── worker.py           # ARQ Prowler worker
├── docker/                 # Docker files
└── migrations/             # Alembic DB migrations
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16
- Redis 7
- AWS account with IAM role for scanning

### Frontend Setup

```bash
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Docker (Full Stack)

```bash
cp .env.example .env
# Edit .env with your credentials
cd docker
docker compose up -d
```

## AWS IAM Setup

To scan an AWS account, create a `CSPMScanRole` in the target account with:

1. **Managed Policies**: `SecurityAudit` + `ViewOnlyAccess`
2. **Trust Policy**: Allow your CSPM platform account to assume the role
3. **External ID**: Generated per-account during registration

See the [implementation plan](docs/architecture.md) for detailed IAM policy JSON.

## Environment Variables

Copy `.env.example` and fill in:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GROQ_API_KEY` | Groq API key for AI remediation |
| `AWS_ACCESS_KEY_ID` | AWS credentials for STS AssumeRole |
| `CLERK_SECRET_KEY` | Clerk authentication |

## License

Private
