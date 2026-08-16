"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  AlertTriangle,
  Info,
  ChevronRight,
  Cloud,
  Database,
  Server,
  Globe,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import type { DashboardData, Finding } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { getDashboardStats } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/SeverityBadge";

const COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#94a3b8",
  pass: "#10b981",
  fail: "#ef4444",
};

const INVENTORY_COLORS = [
  "#3b82f6",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function getServiceIcon(service: string) {
  const s = (service || "").toLowerCase();
  if (s.includes("ec2") || s.includes("compute") || s.includes("lambda"))
    return <Server className="w-4 h-4" />;
  if (s.includes("s3") || s.includes("storage"))
    return <Database className="w-4 h-4" />;
  if (s.includes("vpc") || s.includes("network") || s.includes("route53"))
    return <Globe className="w-4 h-4" />;
  return <Cloud className="w-4 h-4" />;
}

export function DashboardStats({
  accountId,
  onSelectFinding,
}: {
  accountId: string;
  onSelectFinding?: (finding: Finding) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const stats = await getDashboardStats(accountId);
      setData(stats);
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-xl border border-red-100 text-red-600">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        {error || "No data available"}
      </div>
    );
  }

  const alertData = [
    { name: "Critical", value: data.alerts_by_severity.critical, color: COLORS.critical },
    { name: "High", value: data.alerts_by_severity.high, color: COLORS.high },
    { name: "Medium", value: data.alerts_by_severity.medium, color: COLORS.medium },
    { name: "Low", value: data.alerts_by_severity.low, color: COLORS.low },
  ].filter((d) => d.value > 0);

  const complianceEntries = Object.entries(data.compliance_status || {}).map(
    ([name, val]) => ({
      name,
      percentage: typeof val === "number" ? val : 0,
    }),
  );

  return (
    <div className="space-y-8">
      {/* Top Row: Score, Alerts, Inventory Quick Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Security Score */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-6 relative overflow-hidden">
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                className="text-slate-100"
                cx="48"
                cy="48"
                fill="transparent"
                r="38"
                stroke="currentColor"
                strokeWidth="7"
              />
              <circle
                className={
                  data.security_score > 75
                    ? "text-emerald-500"
                    : data.security_score > 40
                      ? "text-amber-500"
                      : "text-rose-500"
                }
                cx="48"
                cy="48"
                fill="transparent"
                r="38"
                stroke="currentColor"
                strokeWidth="7"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 * (1 - data.security_score / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold text-slate-900 leading-none">
                {data.security_score}%
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Security Posture
            </span>
            <p className="text-xl font-bold mt-0.5 text-slate-900">
              {data.security_score > 75
                ? "Protected"
                : data.security_score > 40
                  ? "Needs Attention"
                  : "Critical Risk"}
            </p>
            {data.last_scan ? (
              <span className="text-xs text-slate-500 mt-1 inline-block">
                Last audit: {formatTimeAgo(data.last_scan)}
              </span>
            ) : (
              <span className="text-xs text-slate-400 mt-1 inline-block">
                No scans executed yet
              </span>
            )}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Failing Checks
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold text-slate-900">{data.total_alerts}</span>
            <span className="text-xs text-slate-500 ml-2">requiring remediation</span>
          </div>
          <div className="space-y-2">
            <div className="flex h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              {data.total_alerts > 0 ? (
                alertData.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      width: `${(item.value / data.total_alerts) * 100}%`,
                      backgroundColor: item.color,
                    }}
                    className="h-full"
                    title={`${item.name}: ${item.value}`}
                  />
                ))
              ) : (
                <div className="h-full w-full bg-emerald-500" />
              )}
            </div>
            <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold text-slate-600">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>{data.alerts_by_severity.critical} Crit</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <span>{data.alerts_by_severity.high} High</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                <span>{data.alerts_by_severity.medium} Med</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>{data.alerts_by_severity.low} Low</span>
              </div>
            </div>
          </div>
        </div>

        {/* Assets Discovered */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Discovered Inventory
            </span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold text-slate-900">{data.total_resources}</span>
            <span className="text-xs text-slate-500 ml-2">cloud resources</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.asset_inventory.slice(0, 4).map((item, idx) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 capitalize"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: INVENTORY_COLORS[idx % INVENTORY_COLORS.length] }}
                />
                {item.name}: {item.value}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Second Row: Compliance Frameworks Scorecard & Resource Donut */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance Frameworks (2 columns wide) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900">Regulatory Compliance Standards</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated against CIS, SOC2, NIST, PCI-DSS, HIPAA, and ISO 27001 benchmarks.
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-brand-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complianceEntries.map((fw) => (
              <div
                key={fw.name}
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{fw.name}</span>
                  <span
                    className={`font-bold ${
                      fw.percentage >= 70
                        ? "text-emerald-600"
                        : fw.percentage >= 40
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {fw.percentage}% Compliant
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      fw.percentage >= 70
                        ? "bg-emerald-500"
                        : fw.percentage >= 40
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${fw.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Distribution Chart (1 column wide) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h3 className="font-bold text-slate-900 mb-2">Resource Breakdown</h3>
          <div className="relative w-full h-44 flex items-center justify-center">
            {data.total_resources > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.asset_inventory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.asset_inventory.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={INVENTORY_COLORS[index % INVENTORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      backgroundColor: "#0f172a",
                      color: "#fff",
                      border: "none",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs">No resources</div>
            )}
            {data.total_resources > 0 && (
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-xl font-bold text-slate-900">{data.total_resources}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Assets</span>
              </div>
            )}
          </div>

          <div className="mt-2 space-y-1.5">
            {data.asset_inventory.slice(0, 4).map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: INVENTORY_COLORS[idx % INVENTORY_COLORS.length] }}
                  />
                  <span className="text-slate-600 capitalize font-medium">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Third Row: Recent Security Findings */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-900">High-Priority Security Findings</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Failing controls requiring remediation to improve posture score.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Severity</th>
                <th className="px-6 py-3.5">Policy / Check</th>
                <th className="px-6 py-3.5">Service</th>
                <th className="px-6 py-3.5">Compliance</th>
                <th className="px-6 py-3.5">Resource ID</th>
                <th className="px-6 py-3.5 text-right">Remediation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent_findings && data.recent_findings.length > 0 ? (
                data.recent_findings.map((finding) => (
                  <tr
                    key={finding.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    onClick={() => onSelectFinding?.(finding)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SeverityBadge severity={finding.severity} />
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      <div className="font-medium text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
                        {finding.title}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {finding.check_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-600 capitalize text-xs font-medium">
                        {getServiceIcon(finding.service)}
                        <span>{finding.service}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {finding.compliance_type || "AWS Security"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code
                        className="text-xs font-mono bg-slate-50 px-2 py-1 rounded text-slate-600 border border-slate-200 max-w-[180px] truncate inline-block"
                        title={finding.resource_id}
                      >
                        {finding.resource_id}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFinding?.(finding);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                        <span>AI Fix</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No active high-risk findings detected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
