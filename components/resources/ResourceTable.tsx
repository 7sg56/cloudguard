"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CloudResource } from "@/lib/types";
import { BoolBadge } from "@/components/ui/BoolBadge";
import { getServiceDisplayName } from "@/lib/utils";

interface ResourceTableProps {
  resources: CloudResource[];
  loading: boolean;
}

export function ResourceTable({ resources, loading }: ResourceTableProps) {
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const uniqueServices = Array.from(new Set(resources.map((r) => r.service).filter(Boolean))).sort();
  const filtered = filter === "all" ? resources : resources.filter((r) => r.service === filter);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Loading resources...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <h2 className="text-slate-900 font-semibold flex items-center gap-2">
          Cloud Resources
          <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{filtered.length}</span>
        </h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700"
        >
          <option value="all">All Services</option>
          {uniqueServices.map((s) => (
            <option key={s} value={s!}>{getServiceDisplayName(s!)}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs w-8"></th>
              <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs">Resource ID</th>
              <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs">Type</th>
              <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs">Service</th>
              <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs">Region</th>
              <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs">Public</th>
              <th className="px-5 py-3 font-medium text-slate-500 uppercase text-xs">Encrypted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <>
                <tr
                  key={r.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <td className="px-5 py-3">
                    {expandedId === r.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </td>
                  <td className="px-5 py-3">
                    <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 max-w-[250px] truncate inline-block" title={r.resource_id}>
                      {r.resource_id}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">{r.resource_type}</td>
                  <td className="px-5 py-3 text-slate-600 font-medium capitalize">{r.service || "N/A"}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{r.region || "Global"}</td>
                  <td className="px-5 py-3"><BoolBadge value={r.is_public} trueLabel="Public" falseLabel="Private" /></td>
                  <td className="px-5 py-3"><BoolBadge value={r.encrypted} trueLabel="Yes" falseLabel="No" /></td>
                </tr>
                {expandedId === r.id && (
                  <tr key={`${r.id}-details`} className="bg-slate-50/50">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Object.keys(r.tags).length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-2">Tags</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(r.tags).map(([k, v]) => (
                                <span key={k} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                  <span className="font-medium text-slate-700">{k}</span>: {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {Object.keys(r.raw_data).length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wide mb-2">Details</h4>
                            <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-32">
                              {JSON.stringify(r.raw_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
