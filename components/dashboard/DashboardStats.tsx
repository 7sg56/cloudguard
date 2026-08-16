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
  Server,
  Database,
  Globe,
  Cloud,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Sparkles,
} from "lucide-react";
import type { DashboardData, Finding } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { getDashboardStats } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#94a3b8",
};

const INVENTORY_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function getServiceIcon(service: string) {
  const s = (service || "").toLowerCase();
  if (s.includes("ec2") || s.includes("compute") || s.includes("lambda"))
    return <Server className="w-3.5 h-3.5 text-slate-500" />;
  if (s.includes("s3") || s.includes("storage"))
    return <Database className="w-3.5 h-3.5 text-slate-500" />;
  if (s.includes("vpc") || s.includes("network") || s.includes("route53"))
    return <Globe className="w-3.5 h-3.5 text-slate-500" />;
  return <Cloud className="w-3.5 h-3.5 text-slate-500" />;
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-36 bg-slate-100 rounded-lg border border-slate-200" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6 text-center text-red-600 border-red-200 bg-red-50/50">
        <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm font-medium">{error || "No data available"}</p>
      </Card>
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
    <div className="space-y-6">
      {/* Top 3 KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Security Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Security Score
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{data.security_score}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {data.security_score > 75
                ? "Optimal compliance posture"
                : data.security_score > 40
                  ? "Action required on critical checks"
                  : "High security exposure"}
            </p>
            {data.last_scan && (
              <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                Audited {formatTimeAgo(data.last_scan)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Action Required
            </CardTitle>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{data.total_alerts}</div>
            <div className="flex h-1.5 w-full bg-slate-100 rounded-full overflow-hidden my-2.5">
              {alertData.map((item) => (
                <div
                  key={item.name}
                  style={{
                    width: `${(item.value / data.total_alerts) * 100}%`,
                    backgroundColor: item.color,
                  }}
                  className="h-full"
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 text-[11px] font-medium text-slate-600">
              <span className="text-red-600 font-semibold">{data.alerts_by_severity.critical} Crit</span>
              <span className="text-orange-600 font-semibold">{data.alerts_by_severity.high} High</span>
              <span className="text-yellow-600 font-semibold">{data.alerts_by_severity.medium} Med</span>
              <span className="text-blue-600 font-semibold">{data.alerts_by_severity.low} Low</span>
            </div>
          </CardContent>
        </Card>

        {/* Discovered Inventory */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Discovered Assets
            </CardTitle>
            <Layers className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{data.total_resources}</div>
            <p className="text-xs text-slate-500 mt-1">Cloud resources enumerated</p>
            <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100">
              {data.asset_inventory.slice(0, 4).map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 capitalize font-medium"
                >
                  {item.name}: {item.value}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Middle Row: Compliance Scorecard & Asset Donut */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compliance Standards */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Compliance Standards
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Pass rates across major industry benchmarks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {complianceEntries.map((fw) => (
                <div
                  key={fw.name}
                  className="p-3 bg-slate-50/60 border border-slate-200/80 rounded-md space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{fw.name}</span>
                    <span
                      className={`font-semibold ${
                        fw.percentage >= 70
                          ? "text-emerald-600"
                          : fw.percentage >= 40
                            ? "text-amber-600"
                            : "text-rose-600"
                      }`}
                    >
                      {fw.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
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
          </CardContent>
        </Card>

        {/* Resource Distribution Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Asset Inventory
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Resource breakdown by AWS service.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {data.total_resources > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.asset_inventory}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
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
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        backgroundColor: "#1e293b",
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
                  <span className="text-lg font-bold text-slate-900">{data.total_resources}</span>
                  <span className="text-[9px] text-slate-400 uppercase">Assets</span>
                </div>
              )}
            </div>

            <div className="w-full mt-3 space-y-1">
              {data.asset_inventory.slice(0, 4).map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: INVENTORY_COLORS[idx % INVENTORY_COLORS.length] }}
                    />
                    <span className="text-slate-600 capitalize">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Bottom Table: Priority Findings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900">
            Priority Findings
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Failing security checks requiring remediation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-4 py-2.5">Finding & Check</th>
                  <th className="px-4 py-2.5">Service</th>
                  <th className="px-4 py-2.5">Resource ID</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_findings && data.recent_findings.length > 0 ? (
                  data.recent_findings.map((finding) => (
                    <tr
                      key={finding.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => onSelectFinding?.(finding)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                      <td className="px-4 py-3 max-w-sm">
                        <div className="font-medium text-slate-900 truncate">
                          {finding.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {finding.check_id}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap capitalize text-slate-600">
                        <div className="flex items-center gap-1.5">
                          {getServiceIcon(finding.service)}
                          <span>{finding.service}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <code
                          className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 max-w-[160px] truncate inline-block"
                          title={finding.resource_id}
                        >
                          {finding.resource_id}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFinding?.(finding);
                          }}
                        >
                          <Sparkles className="w-3 h-3 text-brand-600" />
                          Fix
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">
                      No active findings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
