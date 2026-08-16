"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Server, Database, Globe, Layers, Cloud, Lock, ShieldAlert } from "lucide-react";
import type { CloudResource } from "@/lib/types";
import { BoolBadge } from "@/components/ui/BoolBadge";
import { formatTimeAgo } from "@/lib/utils";

interface ResourceTableProps {
  resources: CloudResource[];
  loading: boolean;
}

function getServiceIcon(service: string) {
  const s = (service || "").toLowerCase();
  if (s.includes("ec2") || s.includes("compute") || s.includes("lambda"))
    return <Server className="w-4 h-4 text-blue-500" />;
  if (s.includes("s3") || s.includes("storage"))
    return <Database className="w-4 h-4 text-emerald-500" />;
  if (s.includes("vpc") || s.includes("network") || s.includes("route53"))
    return <Globe className="w-4 h-4 text-indigo-500" />;
  return <Cloud className="w-4 h-4 text-slate-500" />;
}

export function ResourceTable({ resources, loading }: ResourceTableProps) {
  const [selectedService, setSelectedService] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const uniqueServices = useMemo(
    () => Array.from(new Set(resources.map((r) => r.service).filter(Boolean))).sort(),
    [resources],
  );

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const matchService = selectedService === "all" || r.service === selectedService;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (r.resource_id || "").toLowerCase().includes(q) ||
        (r.resource_type || "").toLowerCase().includes(q) ||
        (r.region || "").toLowerCase().includes(q);
      return matchService && matchQuery;
    });
  }, [resources, selectedService, searchQuery]);

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-2" />
        <p className="text-slate-400 text-xs">Loading discovered AWS inventory...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Discovered Cloud Assets
              <span className="text-xs font-semibold text-slate-600 bg-slate-200 px-2.5 py-0.5 rounded-full">
                {filtered.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live inventory of cloud infrastructure enumerated via Boto3 discovery.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resources by ID, ARN, or type..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-slate-800"
            />
          </div>

          {/* Service Dropdown */}
          <div>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 capitalize"
            >
              <option value="all">All Services ({resources.length})</option>
              {uniqueServices.map((s) => (
                <option key={s} value={s!}>
                  {s!.toUpperCase()} ({resources.filter((r) => r.service === s).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Body */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Cloud className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No resources found</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {searchQuery || selectedService !== "all"
              ? "Try adjusting search or service filters."
              : "Run a scan to discover cloud assets."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5 w-8"></th>
                <th className="px-4 py-3.5">Resource ID / ARN</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Service</th>
                <th className="px-4 py-3.5">Region</th>
                <th className="px-4 py-3.5">Public Exposure</th>
                <th className="px-4 py-3.5">Encrypted</th>
                <th className="px-4 py-3.5">Last Audited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tbody key={r.id} className="contents">
                  <tr
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors group"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td className="px-4 py-3.5 text-slate-400 group-hover:text-slate-700">
                      {expandedId === r.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <code
                        className="text-xs font-mono bg-slate-50 px-2 py-1 rounded text-slate-800 border border-slate-200 block truncate group-hover:border-brand-300"
                        title={r.resource_id}
                      >
                        {r.resource_id}
                      </code>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs font-medium">
                      {r.resource_type}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 capitalize font-medium text-xs text-slate-700">
                        {getServiceIcon(r.service || "")}
                        <span>{r.service || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs font-mono whitespace-nowrap">
                      {r.region || "global"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <BoolBadge
                        value={r.is_public}
                        trueLabel="Public"
                        falseLabel="Private"
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <BoolBadge
                        value={r.encrypted}
                        trueLabel="Encrypted"
                        falseLabel="Unencrypted"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                      {formatTimeAgo(r.last_seen)}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="bg-slate-50/70 border-b border-slate-200">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-3 text-xs">
                          {r.tags && Object.keys(r.tags).length > 0 && (
                            <div>
                              <span className="font-bold text-slate-700 block mb-1">
                                Resource Tags:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(r.tags).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-mono"
                                  >
                                    <span className="font-semibold text-slate-900">{k}</span>: {v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">
                              Raw Configuration Metadata:
                            </span>
                            <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto max-h-60">
                              {JSON.stringify(r.raw_data || {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
