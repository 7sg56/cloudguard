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
} from "lucide-react";
import type { Finding, PaginatedFindings } from "@/lib/types";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Toast } from "@/components/ui/Toast";
import { getFindings } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <Card className="overflow-hidden">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header & Controls */}
      <CardHeader className="pb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Security Findings
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {total}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Audited cloud controls across compliance benchmarks.
            </CardDescription>
          </div>

          {/* Status Tabs */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setStatusFilter("attention")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                statusFilter === "attention"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Action Required
            </button>
            <button
              onClick={() => setStatusFilter("pass")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                statusFilter === "pass"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Passed
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                statusFilter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          <div className="md:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, check ID, or resource ID..."
              className="pl-8 text-xs h-9 bg-white"
            />
          </div>

          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 capitalize"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Informational</option>
            </select>
          </div>

          <div>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 capitalize"
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
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-xs">Loading findings...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50 text-xs">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-500" />
            {error}
          </div>
        ) : displayedFindings.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-xs font-semibold text-slate-700">No matching findings</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-4 py-2.5">Check / Finding</th>
                  <th className="px-4 py-2.5">Service</th>
                  <th className="px-4 py-2.5">Standard</th>
                  <th className="px-4 py-2.5">Resource ID</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedFindings.map((finding) => (
                  <tr
                    key={finding.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => onSelectFinding(finding)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <SeverityBadge severity={finding.severity} />
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="font-medium text-slate-900 truncate">
                        {finding.title}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {finding.check_id}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap capitalize text-slate-600 font-medium">
                      {finding.service}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {finding.compliance_type || "AWS Standard"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code
                        className="text-[11px] font-mono bg-slate-50 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200 max-w-[180px] truncate inline-block"
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
                          onSelectFinding(finding);
                        }}
                      >
                        <Sparkles className="w-3 h-3 text-brand-600" />
                        Remediate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing {displayedFindings.length} of {total} findings
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2 text-slate-700 font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
