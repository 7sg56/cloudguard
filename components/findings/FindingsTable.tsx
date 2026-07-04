"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, Ban, AlertTriangle, RefreshCw } from "lucide-react";
import type { Finding, PaginatedFindings } from "@/lib/types";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Toast } from "@/components/ui/Toast";
import { getFindings } from "@/lib/api";

// ── Finding-specific status badge ───────────────────────────────────────────

function FindingStatusBadge({ status }: { status: string }) {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
        <Check className="w-3 h-3" />
        Resolved
      </span>
    );
  }
  if (status === "rescanning") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        Rescanning
      </span>
    );
  }
  if (status === "manual") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 border border-yellow-200">
        <AlertTriangle className="w-3 h-3" /> Manual
      </span>
    );
  }
  if (status === "not_found") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-slate-200 text-slate-600 border border-slate-300">
        <Ban className="w-3 h-3" /> Not Found
      </span>
    );
  }
  return null;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function FindingsTable({
  accountId,
  onSelectFinding,
  updatedFinding,
}: {
  accountId: string;
  onSelectFinding: (f: Finding) => void;
  updatedFinding: Finding | null;
}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [severityFilter, setSeverityFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"attention" | "pass" | "all">("attention");

  const [recentlyResolved, setRecentlyResolved] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: PaginatedFindings = await getFindings({
        account_id: accountId,
        page,
        page_size: pageSize,
        severity: severityFilter !== "all" ? severityFilter : undefined,
        service: serviceFilter !== "all" ? serviceFilter : undefined,
        statuses:
          statusFilter === "attention"
            ? "fail,manual,rescanning"
            : statusFilter === "pass"
              ? "pass"
              : undefined,
      });
      setFindings(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      const svcSet = new Set(data.items.map((f) => f.service));
      setServices((prev) => {
        const merged = new Set([...prev, ...svcSet]);
        return Array.from(merged).sort();
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load findings.");
    } finally {
      setLoading(false);
    }
  }, [accountId, page, pageSize, severityFilter, serviceFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [severityFilter, serviceFilter, statusFilter]);

  // Listen for finding updates from parent
  useEffect(() => {
    if (updatedFinding) {
      setFindings((prev) =>
        prev.map((f) => (f.id === updatedFinding.id ? updatedFinding : f)),
      );
      if (updatedFinding.status === "pass" || updatedFinding.status === "not_found") {
        setRecentlyResolved((prev) => new Set([...prev, updatedFinding.id]));
        setToast("Finding verified -- issue resolved!");
        setTimeout(() => {
          setRecentlyResolved((prev) => {
            const next = new Set(prev);
            next.delete(updatedFinding.id);
            return next;
          });
          fetchData();
        }, 30000);
      }
    }
  }, [updatedFinding, fetchData]);

  const handleDismissResolved = useCallback((findingId: string) => {
    setRecentlyResolved((prev) => {
      const next = new Set(prev);
      next.delete(findingId);
      return next;
    });
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Filters Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
        <h2 className="text-slate-900 font-semibold flex items-center gap-2">
          Security Findings
          <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            {total}
          </span>
        </h2>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setStatusFilter("attention")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === "attention" ? "bg-red-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Attention
            </button>
            <button
              onClick={() => setStatusFilter("pass")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-x border-slate-200 ${statusFilter === "pass" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Passed
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === "all" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              All
            </button>
          </div>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
            <option value="all">All Services</option>
            {services.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={fetchData} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Refresh Findings">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Loading security findings...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-red-500 text-center bg-red-50">{error}</div>
      ) : findings.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          <p>
            {statusFilter === "attention"
              ? "No attention needed -- all checks are passing!"
              : statusFilter === "pass"
                ? "No passed findings yet."
                : "No findings match the criteria."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs w-24">Severity</th>
                  <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs w-32">Service</th>
                  <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs">Check / Resource</th>
                  <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs w-28">Status</th>
                  <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs w-36">Compliance</th>
                  <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs w-32">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {findings.map((f) => {
                  const isResolved = recentlyResolved.has(f.id);
                  return (
                    <tr
                      key={f.id}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors group ${isResolved ? "bg-emerald-50/40 border-l-2 border-l-emerald-500" : f.status === "pass" ? "bg-emerald-50/20" : ""}`}
                      onClick={() => onSelectFinding(f)}
                    >
                      <td className="px-5 py-3 font-medium">
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td className="px-5 py-3 text-slate-600 font-medium capitalize">{f.service}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className={`font-semibold ${f.status === "pass" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                              {f.title}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-sm" title={f.resource_id}>
                              {f.resource_id}
                            </div>
                          </div>
                          {isResolved && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">Resolved</span>
                              <button onClick={(e) => { e.stopPropagation(); handleDismissResolved(f.id); }} className="text-xs text-slate-400 hover:text-slate-600 px-1" title="Dismiss">
                                X
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <FindingStatusBadge status={f.status} />
                      </td>
                      <td className="px-5 py-3">
                        {f.compliance_type ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {f.compliance_type}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {f.region === "global" ? "Global" : f.region}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of {total} findings
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed">First</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
              <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed">Last</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
