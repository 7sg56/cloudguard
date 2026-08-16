"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Server, Database, Globe, Cloud } from "lucide-react";
import type { CloudResource } from "@/lib/types";
import { BoolBadge } from "@/components/ui/BoolBadge";
import { formatTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ResourceTableProps {
  resources: CloudResource[];
  loading: boolean;
}

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
      <Card className="p-12 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-700 mx-auto mb-2" />
        <p className="text-slate-400 text-xs">Loading discovered AWS inventory...</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Discovered Cloud Assets
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {filtered.length}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Live inventory of cloud infrastructure enumerated via Boto3 discovery.
            </CardDescription>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div className="md:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resources by ID, ARN, or type..."
              className="pl-8 text-xs h-9 bg-white"
            />
          </div>

          <div>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 capitalize"
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
      </CardHeader>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Cloud className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No resources found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5 w-6"></th>
                  <th className="px-3.5 py-2.5">Resource ID / ARN</th>
                  <th className="px-3.5 py-2.5">Type</th>
                  <th className="px-3.5 py-2.5">Service</th>
                  <th className="px-3.5 py-2.5">Region</th>
                  <th className="px-3.5 py-2.5">Exposure</th>
                  <th className="px-3.5 py-2.5">Encrypted</th>
                  <th className="px-3.5 py-2.5">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tbody key={r.id} className="contents">
                    <tr
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <td className="px-3.5 py-3 text-slate-400">
                        {expandedId === r.id ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </td>
                      <td className="px-3.5 py-3 max-w-xs">
                        <code
                          className="text-[11px] font-mono bg-slate-50 px-1.5 py-0.5 rounded text-slate-800 border border-slate-200 block truncate"
                          title={r.resource_id}
                        >
                          {r.resource_id}
                        </code>
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 font-medium">
                        {r.resource_type}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 capitalize text-slate-700">
                          {getServiceIcon(r.service || "")}
                          <span>{r.service || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-slate-500 font-mono whitespace-nowrap">
                        {r.region || "global"}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <BoolBadge
                          value={r.is_public}
                          trueLabel="Public"
                          falseLabel="Private"
                        />
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <BoolBadge
                          value={r.encrypted}
                          trueLabel="Encrypted"
                          falseLabel="Unencrypted"
                        />
                      </td>
                      <td className="px-3.5 py-3 text-slate-400 whitespace-nowrap">
                        {formatTimeAgo(r.last_seen)}
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={8} className="px-5 py-3.5">
                          <div className="space-y-2 text-xs">
                            {r.tags && Object.keys(r.tags).length > 0 && (
                              <div>
                                <span className="font-semibold text-slate-700 block mb-1">
                                  Tags:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(r.tags).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono text-[11px]"
                                    >
                                      <span className="font-semibold">{k}</span>: {v}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-slate-700 block mb-1">
                                Metadata:
                              </span>
                              <pre className="p-2.5 bg-slate-950 text-slate-100 rounded-md font-mono text-[11px] overflow-x-auto max-h-52">
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
      </CardContent>
    </Card>
  );
}
