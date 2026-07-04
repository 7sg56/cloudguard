// ── Shared Types for Cloud Security Module ──────────────────────────────────
// Single source of truth -- imported by all components, hooks, and API routes.

export interface CloudAccount {
  id: string;
  account_id: string;
  name: string;
  provider: string;
  role_arn: string | null;
  external_id?: string;
  environment: string;
  regions: string[];
  status?: "pending" | "connected" | "error" | "disconnected";
  created_at: string;
  updated_at: string;
  last_scan_at: string | null;
}

export interface ScanResult {
  id: string;
  account_id: string;
  status: string;
  scan_type: string;
  started_at: string;
  finished_at: string | null;
  findings_count: number;
  resources_scanned?: number;
  error_message: string | null;
}

export interface CloudResource {
  id: string;
  resource_id: string;
  resource_type: string;
  service: string | null;
  region: string | null;
  tags: Record<string, string>;
  is_public: boolean | null;
  encrypted: boolean | null;
  raw_data: Record<string, unknown>;
  last_seen: string;
}

export interface ServiceSummary {
  service: string;
  count: number;
  public_count: number;
  unencrypted_count: number;
}

export interface Finding {
  id: string;
  account_id: string;
  check_id: string;
  resource_id: string;
  resource_type: string;
  service: string;
  region: string;
  title: string;
  status: "fail" | "pass" | "manual" | "rescanning" | "not_found" | "error";
  severity: "critical" | "high" | "medium" | "low" | "info";
  compliance_type: string | null;
  description: string;
  recommendation: string;
  updated_at: string;
  raw_data: { prowler_status: string; last_rescan_at?: string };
}

export interface PaginatedFindings {
  items: Finding[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardData {
  security_score: number;
  total_alerts: number;
  alerts_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  compliance_status: Record<
    string,
    {
      pass: number;
      fail: number;
      muted: number;
      total: number;
      score: number;
    }
  >;
  asset_inventory: {
    name: string;
    value: number;
    types: { name: string; count: number }[];
  }[];
  total_resources: number;
  last_scan: string | null;
  recent_findings: Finding[];
}

export interface RemediationResponse {
  steps: string;
  model: string;
  tokens_used?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
