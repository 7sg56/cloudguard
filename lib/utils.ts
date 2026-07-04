import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names using clsx + tailwind-merge (shadcn/ui compatible).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Severity Helpers ──────────────────────────────────────────────────────

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: "text-red-600",
    high: "text-orange-500",
    medium: "text-amber-500",
    low: "text-blue-500",
    info: "text-slate-500",
  };
  return colors[severity] || colors.info;
}

export function getSeverityHex(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#3b82f6",
    info: "#94a3b8",
  };
  return colors[severity] || colors.info;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    running: "text-blue-500",
    completed: "text-emerald-500",
    failed: "text-red-500",
    pending: "text-amber-500",
    pass: "text-emerald-500",
    fail: "text-red-500",
    rescanning: "text-amber-500",
    manual: "text-yellow-600",
    not_found: "text-slate-500",
    connected: "text-emerald-500",
    error: "text-red-500",
    disconnected: "text-slate-400",
  };
  return colors[status] || "text-slate-500";
}

// ── Formatters ────────────────────────────────────────────────────────────

export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString();
}

export function formatDuration(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return "N/A";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ── Service Display Names ─────────────────────────────────────────────────

const SERVICE_NAMES: Record<string, string> = {
  ec2: "EC2",
  s3: "S3",
  rds: "RDS",
  lambda: "Lambda",
  iam: "IAM",
  vpc: "VPC",
  cloudfront: "CloudFront",
  route53: "Route 53",
  ecs: "ECS",
  eks: "EKS",
  dynamodb: "DynamoDB",
  sqs: "SQS",
  sns: "SNS",
  cloudwatch: "CloudWatch",
  kms: "KMS",
  secretsmanager: "Secrets Manager",
  elasticache: "ElastiCache",
  redshift: "Redshift",
  elb: "ELB",
  elbv2: "ELBv2",
};

export function getServiceDisplayName(service: string): string {
  return SERVICE_NAMES[service.toLowerCase()] || service.toUpperCase();
}

// ── Compliance Names ──────────────────────────────────────────────────────

const COMPLIANCE_NAMES: Record<string, string> = {
  cis_aws: "CIS AWS",
  soc2: "SOC 2",
  pci_dss: "PCI DSS",
  hipaa: "HIPAA",
  nist_800_53: "NIST 800-53",
  gdpr: "GDPR",
  iso_27001: "ISO 27001",
};

export function getComplianceName(key: string): string {
  return COMPLIANCE_NAMES[key] || key.replace(/_/g, " ").toUpperCase();
}
