// ── API Client ──────────────────────────────────────────────────────────────
// Typed fetch helpers for the CSPM API. When USE_MOCK_DATA is true,
// returns mock data directly. Otherwise proxies to the FastAPI backend.

import type {
  CloudAccount,
  CloudResource,
  ServiceSummary,
  Finding,
  PaginatedFindings,
  ScanResult,
  DashboardData,
  RemediationResponse,
  ChatMessage,
} from "./types";

import {
  USE_MOCK_DATA,
  MOCK_ACCOUNTS,
  MOCK_RESOURCES,
  MOCK_SERVICE_SUMMARY,
  MOCK_DASHBOARD_DATA,
  MOCK_FINDINGS,
  getMockPaginatedFindings,
} from "./mock-data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ── Internal Helpers ───────────────────────────────────────────────────────

type AuthTokenGetter = () => Promise<string | null>;

let _getToken: AuthTokenGetter = async () => null;

/** Register the auth token getter (called by the auth hook at mount). */
export function setAuthTokenGetter(getter: AuthTokenGetter) {
  _getToken = getter;
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await _getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}/api/cloud-security${path}`, { ...options, headers });
}

// ── Accounts ───────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<CloudAccount[]> {
  if (USE_MOCK_DATA) return MOCK_ACCOUNTS;
  const res = await fetchWithAuth("/accounts");
  if (!res.ok) throw new Error("Failed to fetch accounts");
  return res.json();
}

export async function createAccount(data: {
  account_id: string;
  name: string;
  role_arn: string;
  environment: string;
  regions: string;
}): Promise<CloudAccount> {
  const res = await fetchWithAuth("/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create account");
  return res.json();
}

export async function deleteAccount(id: string): Promise<void> {
  if (USE_MOCK_DATA) return;
  const res = await fetchWithAuth(`/accounts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete account");
}

export async function validateAccountRole(accountId: string): Promise<{ valid: boolean; error?: string }> {
  if (USE_MOCK_DATA) return { valid: true };
  const res = await fetchWithAuth(`/accounts/${accountId}/validate`);
  return res.json();
}

// ── Resources ──────────────────────────────────────────────────────────────

export async function getResources(accountId: string): Promise<CloudResource[]> {
  if (USE_MOCK_DATA) return MOCK_RESOURCES;
  const res = await fetchWithAuth(`/resources/${accountId}`);
  if (!res.ok) throw new Error("Failed to fetch resources");
  return res.json();
}

export async function getResourceSummary(accountId: string): Promise<ServiceSummary[]> {
  if (USE_MOCK_DATA) return MOCK_SERVICE_SUMMARY;
  const res = await fetchWithAuth(`/resources/${accountId}/summary`);
  if (!res.ok) throw new Error("Failed to fetch resource summary");
  return res.json();
}

// ── Findings ───────────────────────────────────────────────────────────────

export async function getFindings(params: {
  account_id: string;
  page?: number;
  page_size?: number;
  severity?: string;
  service?: string;
  statuses?: string;
}): Promise<PaginatedFindings> {
  if (USE_MOCK_DATA) {
    return getMockPaginatedFindings({
      page: params.page || 1,
      pageSize: params.page_size || 50,
      severity: params.severity,
      service: params.service,
      statuses: params.statuses,
    });
  }
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") searchParams.set(key, String(value));
  });
  const res = await fetchWithAuth(`/findings?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch findings");
  return res.json();
}

export async function getFinding(findingId: string): Promise<Finding> {
  if (USE_MOCK_DATA) {
    const found = MOCK_FINDINGS.find((f) => f.id === findingId);
    if (!found) throw new Error("Finding not found");
    return found;
  }
  const res = await fetchWithAuth(`/findings/${findingId}`);
  if (!res.ok) throw new Error("Failed to fetch finding");
  return res.json();
}

export async function rescanFinding(findingId: string): Promise<Finding> {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 1500));
    const found = MOCK_FINDINGS.find((f) => f.id === findingId);
    if (!found) throw new Error("Finding not found");
    return { ...found, status: "pass", raw_data: { ...found.raw_data, last_rescan_at: new Date().toISOString() } };
  }
  const res = await fetchWithAuth(`/findings/${findingId}/rescan`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to rescan finding");
  return res.json();
}

// ── Scans ──────────────────────────────────────────────────────────────────

export async function triggerScan(accountId: string, includeProwler: boolean = true): Promise<ScanResult> {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 500));
    return {
      id: `scan-mock-${Date.now()}`,
      account_id: accountId,
      status: "running",
      scan_type: includeProwler ? "full" : "resources_only",
      started_at: new Date().toISOString(),
      finished_at: null,
      findings_count: 0,
      resources_scanned: 0,
      error_message: null,
    };
  }
  const res = await fetchWithAuth(`/scan/${accountId}?include_prowler=${includeProwler}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to trigger scan");
  return res.json();
}

export async function getScanStatus(scanId: string): Promise<ScanResult> {
  if (USE_MOCK_DATA) {
    return {
      id: scanId,
      account_id: "mock",
      status: "completed",
      scan_type: "full",
      started_at: new Date(Date.now() - 120000).toISOString(),
      finished_at: new Date().toISOString(),
      findings_count: 24,
      resources_scanned: 156,
      error_message: null,
    };
  }
  const res = await fetchWithAuth(`/scan/${scanId}/status`);
  if (!res.ok) throw new Error("Failed to fetch scan status");
  return res.json();
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboardStats(accountId: string): Promise<DashboardData> {
  if (USE_MOCK_DATA) return MOCK_DASHBOARD_DATA;
  const res = await fetchWithAuth(`/stats/${accountId}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

// ── Remediation (Groq AI) ──────────────────────────────────────────────────

const MOCK_REMEDIATION_DELAY = 800; // simulate network latency

function generateMockRemediation(finding: {
  title: string;
  service: string;
  severity: string;
  resource_id: string;
  region: string;
}): string {
  return `## Impact Assessment

This **${finding.severity}** severity finding in **${finding.service}** poses a security risk. ${finding.title}

Resource: \`${finding.resource_id}\` in \`${finding.region}\`

---

## AWS CLI Fix

\`\`\`bash
# Step 1: Identify the affected resource
aws ${finding.service} describe-* --region ${finding.region}

# Step 2: Apply the remediation
aws ${finding.service} update-* --region ${finding.region} \\
  --resource-id ${finding.resource_id} \\
  --apply-fix true
\`\`\`

## Terraform Fix

\`\`\`hcl
resource "aws_${finding.service}_config" "fix" {
  # Ensure compliance by adding the required configuration
  enable_encryption = true
  public_access     = false

  tags = {
    Remediated = "true"
    ManagedBy  = "CSPM"
  }
}
\`\`\`

## AWS Console Steps

1. Sign in to the **AWS Management Console**
2. Navigate to **${finding.service.toUpperCase()}** service
3. Select the affected resource: \`${finding.resource_id}\`
4. Click **Edit** or **Modify**
5. Apply the recommended security configuration
6. Click **Save** to apply changes

## Verification

\`\`\`bash
# Verify the fix was applied
aws ${finding.service} describe-* --region ${finding.region} \\
  --resource-id ${finding.resource_id} \\
  --query 'SecurityConfig'
\`\`\`

Run a rescan after applying the fix to confirm the finding is resolved.`;
}

export async function getRemediation(finding: {
  title: string;
  description: string;
  recommendation: string;
  severity: string;
  service: string;
  resource_type: string;
  resource_id: string;
  region: string;
}): Promise<RemediationResponse> {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, MOCK_REMEDIATION_DELAY));
    return {
      steps: generateMockRemediation(finding),
      model: "mock-llama-3.3-70b",
      tokens_used: 1247,
    };
  }
  const res = await fetchWithAuth("/remediation/resolve", {
    method: "POST",
    body: JSON.stringify(finding),
  });
  if (!res.ok) throw new Error("Failed to get remediation");
  return res.json();
}

export async function chatRemediation(
  findingContext: string,
  messages: ChatMessage[],
): Promise<{ reply: string; model: string }> {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, MOCK_REMEDIATION_DELAY));
    const lastMsg = messages[messages.length - 1]?.content || "";
    return {
      reply: `Based on your question about "${lastMsg.slice(0, 60)}...", here is additional guidance:\n\n` +
        `1. **Review the current configuration** using the AWS CLI commands provided above\n` +
        `2. **Test in a staging environment** before applying to production\n` +
        `3. **Enable CloudTrail logging** to monitor for any configuration drift\n` +
        `4. **Set up AWS Config rules** to prevent recurrence\n\n` +
        `Let me know if you need more specific details about any of these steps.`,
      model: "mock-llama-3.3-70b",
    };
  }
  const res = await fetchWithAuth("/remediation/chat", {
    method: "POST",
    body: JSON.stringify({ finding_context: findingContext, messages }),
  });
  if (!res.ok) throw new Error("Failed to send chat message");
  return res.json();
}
