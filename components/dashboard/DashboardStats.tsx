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
  MoreHorizontal,
  Cloud,
  Database,
  Server,
  Globe,
} from "lucide-react";
import type { DashboardData, Finding } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { getDashboardStats } from "@/lib/api";

const COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#94a3b8",
  pass: "#22c55e",
  fail: "#ef4444",
};

const INVENTORY_COLORS = [
  "#3b82f6",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
];

function getServiceIcon(service: string) {
  const s = service.toLowerCase();
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-slate-100 rounded-xl"></div>
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

  const complianceData = Object.entries(data.compliance_status)
    .map(([key, val]) => ({
      name: key.replace(/_/g, " ").toUpperCase(),
      violations: val.fail,
      total: val.total,
      percentage: val.total > 0 ? Math.round(((val.total - val.fail) / val.total) * 100) : 0,
    }))
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Top Row: Score, Alerts, Compliance */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Security Score */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-slate-100" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
              <circle
                className={data.security_score > 80 ? "text-green-500" : data.security_score > 50 ? "text-yellow-500" : "text-red-500"}
                cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 * (1 - data.security_score / 100)}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-2xl font-bold text-slate-800">{data.security_score}%</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Security Score</h3>
            <p className="text-2xl font-bold mt-1 text-slate-800">
              {data.security_score > 80 ? "Healthy" : data.security_score > 50 ? "Fair" : "Needs Attention"}
            </p>
            {data.last_scan && (
              <span className="text-[10px] text-slate-400 font-medium">
                Last scanned: {formatTimeAgo(data.last_scan)}
              </span>
            )}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Total Active Alerts</h3>
          <div className="flex items-end justify-between mb-4">
            <span className="text-3xl font-bold text-slate-800">{data.total_alerts}</span>
          </div>
          <div className="flex h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            {alertData.map((item) => (
              <div
                key={item.name}
                style={{ width: `${(item.value / data.total_alerts) * 100}%`, backgroundColor: item.color }}
                className="h-full"
                title={`${item.name}: ${item.value}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-[11px] font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.critical }}></span>{" "}
              {data.alerts_by_severity.critical} Critical
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.high }}></span>{" "}
              {data.alerts_by_severity.high} High
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.medium }}></span>{" "}
              {data.alerts_by_severity.medium} Mid
            </div>
          </div>
        </div>

        {/* Compliance Status */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Compliance Status</h3>
          <div className="space-y-3">
            {complianceData.length > 0 ? (
              complianceData.map((fw) => (
                <div key={fw.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{fw.name}</span>
                    <span>{fw.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${fw.percentage}%`,
                        backgroundColor: fw.percentage > 80 ? COLORS.pass : fw.percentage > 50 ? COLORS.medium : COLORS.fail,
                      }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-400 text-xs">No compliance data</div>
            )}
          </div>
        </div>
      </section>

      {/* Second Row: Asset Inventory */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resource Distribution Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[320px]">
          <h3 className="w-full text-left font-bold text-slate-800 mb-6 flex justify-between items-center">
            <span>Resource Distribution</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {data.total_resources} Total
            </span>
          </h3>
          <div className="relative w-48 h-48">
            {data.total_resources > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.asset_inventory} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                    {data.asset_inventory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={INVENTORY_COLORS[index % INVENTORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: "8px", padding: "8px", fontSize: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <Cloud className="w-12 h-12 mb-2" />
                <span className="text-xs">No resources</span>
              </div>
            )}
            {data.total_resources > 0 && (
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-3xl font-bold text-slate-800">{data.total_resources}</span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Assets</span>
              </div>
            )}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 w-full px-4">
            {data.asset_inventory.slice(0, 6).map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: INVENTORY_COLORS[idx % INVENTORY_COLORS.length] }} />
                  <span className="text-slate-600 font-medium truncate capitalize max-w-[80px]" title={item.name}>{item.name}</span>
                </div>
                <span className="text-slate-400 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Service Overview */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
          <h3 className="font-bold text-slate-800 mb-6">Service Overview</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[240px]">
            {data.asset_inventory.length > 0 ? (
              data.asset_inventory.map((item) => (
                <div key={item.name} className="group border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        {getServiceIcon(item.name)}
                      </div>
                      <span className="font-medium text-slate-700 capitalize">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full text-xs">{item.value}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-3">
                    {item.types.map((t, tIdx) => {
                      const typePct = (t.count / item.value) * 100;
                      return (
                        <div key={t.name} className="h-full first:rounded-l-full last:rounded-r-full hover:opacity-80 transition-opacity"
                          style={{ width: `${typePct}%`, backgroundColor: INVENTORY_COLORS[tIdx % INVENTORY_COLORS.length] }}
                          title={`${t.name}: ${t.count}`}
                        />
                      );
                    })}
                  </div>
                  {item.types && item.types.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 pl-1">
                      {item.types.slice(0, 6).map((t, tIdx) => (
                        <div key={t.name} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: INVENTORY_COLORS[tIdx % INVENTORY_COLORS.length] }} />
                          <span className="font-medium text-slate-700">{t.count}</span>
                          <span className="truncate max-w-[100px] text-slate-400" title={t.name}>{t.name.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                <Info className="w-8 h-8 mb-2 opacity-50" />
                No services detected
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recent High-Risk Findings */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Recent High-Risk Findings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Resource ID</th>
                <th className="px-6 py-4">Policy / Title</th>
                <th className="px-6 py-4">Service</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.recent_findings && data.recent_findings.length > 0 ? (
                data.recent_findings.map((finding) => (
                  <tr key={finding.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => onSelectFinding?.(finding)}>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wide ${
                        finding.severity === "critical" ? "bg-red-50 text-red-600 border border-red-200"
                          : finding.severity === "high" ? "bg-orange-50 text-orange-600 border border-orange-200"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {finding.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 max-w-[150px] truncate inline-block" title={finding.resource_id}>
                        {finding.resource_id}
                      </code>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800 max-w-[250px] truncate" title={finding.title}>{finding.title}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 capitalize">
                        {getServiceIcon(finding.service)}
                        <span>{finding.service}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{formatTimeAgo(finding.updated_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); onSelectFinding?.(finding); }} className="text-slate-400 hover:text-blue-500 transition-colors">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No recent high-risk findings.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
