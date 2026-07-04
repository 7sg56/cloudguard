// ── Constants ───────────────────────────────────────────────────────────────

import {
  LayoutDashboard,
  AlertTriangle,
  Server,
  UserCog,
  ScanLine,
  type LucideIcon,
} from "lucide-react";

// ── Navigation ──────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Findings", href: "/findings", icon: AlertTriangle },
  { label: "Resources", href: "/resources", icon: Server },
  { label: "Accounts", href: "/accounts", icon: UserCog },
  { label: "Scans", href: "/scans", icon: ScanLine },
];

// ── AWS Regions ─────────────────────────────────────────────────────────────

export const AWS_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "eu-north-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-south-1",
  "sa-east-1",
  "ca-central-1",
] as const;

// ── Severity Order (for sorting) ────────────────────────────────────────────

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// ── Environment Options ─────────────────────────────────────────────────────

export const ENVIRONMENTS = [
  "production",
  "staging",
  "development",
  "testing",
] as const;

// ── Compliance Frameworks ───────────────────────────────────────────────────

export const COMPLIANCE_FRAMEWORKS = [
  { key: "cis_aws", name: "CIS AWS", description: "CIS AWS Foundations Benchmark" },
  { key: "soc2", name: "SOC 2", description: "SOC 2 Type II" },
  { key: "pci_dss", name: "PCI DSS", description: "Payment Card Industry Data Security Standard" },
  { key: "hipaa", name: "HIPAA", description: "Health Insurance Portability and Accountability Act" },
  { key: "nist_800_53", name: "NIST 800-53", description: "NIST Special Publication 800-53" },
] as const;
