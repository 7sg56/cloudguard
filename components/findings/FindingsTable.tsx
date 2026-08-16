"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Loader2,
  AlertTriangle,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { Finding, PaginatedFindings } from "@/lib/types";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Toast } from "@/components/ui/Toast";
import { getFindings } from "@/lib/api";
import { formatTimeAgo } from "@/lib/utils";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"attention" | "pass" | "all">("attention");

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
      const svcSet = new Set(data.items.map((f) => f.service).filter(Boolean));
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
        setToast("Finding verified -- issue resolved!");
        setTimeout(() => {
          fetchData();
        }, 5000);
      }
    }
  }, [updatedFinding, fetchData]);

  // Client-side search filter
  const displayedFindings = useMemo(() => {
    if (!searchQuery.trim()) return findings;
    const q = searchQuery.toLowerCase();
    return findings.filter(
      (f) =>
        (f.title || "").toLowerCase().includes(q) ||
        (f.check_id || "").toLowerCase().includes(q) ||
        (f.resource_id || "").toLowerCase().includes(q) ||
        (f.service || "").toLowerCase().includes(q),
    );
  }, [findings, searchQuery]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Filters Header */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Security Compliance Findings
              <span className="text-xs font-semibold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full">
                {total}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identified security misconfigurations and regulatory compliance gaps.
            </p>
          </div>

          {/* Status Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setStatusFilter("attention")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                statusFilter === "attention"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Action Required
            </button>
            <button
              onClick={() => setStatusFilter("pass")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                statusFilter === "pass"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Resolved / Passed
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings by title, check ID, or resource ARN..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-slate-800"
            />
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 capitalize"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Informational</option>
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 capitalize"
            >
              <option value="all">All AWS Services</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Findings Table */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto mb-2" />
          <p className="text-slate-400 text-xs">Loading findings...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 bg-red-50 text-sm">
          <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-red-500" />
          {error}
        </div>
      ) : displayedFindings.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Check className="w-10 h-10 mx-auto mb-2 text-emerald-500/60" />
          <p className="text-sm font-semibold text-slate-700">No matching findings</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {searchQuery || severityFilter !== "all" || serviceFilter !== "all"
              ? "Try clearing filters to view all records."
              : "All evaluated security checks are passing."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Severity</th>
                <th className="px-5 py-3.5">Title & Policy Check</th>
                <th className="px-5 py-3.5">Service</th>
                <th className="px-5 py-3.5">Standards</th>
                <th className="px-5 py-3.5">Resource ID</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedFindings.map((finding) => (
                <tr
                  key={finding.id}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  onClick={() => onSelectFinding(finding)}
                >
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <SeverityBadge severity={finding.severity} />
                  </td>
                  <td className="px-5 py-3.5 max-w-md">
                    <div className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
                      {finding.title}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {finding.check_id}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                      {finding.service}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {finding.compliance_type || "AWS Standard"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <code
                      className="text-xs font-mono bg-slate-50 px-2 py-1 rounded text-slate-600 border border-slate-200 max-w-[200px] truncate inline-block"
                      title={finding.resource_id}
                    >
                      {finding.resource_id}
                    </code>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFinding(finding);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-lg transition-colors shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                      <span>Remediate</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
        <div>
          Showing {displayedFindings.length} of {total} findings
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
