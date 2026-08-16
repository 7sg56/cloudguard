"use client";

import { useEffect, useState } from "react";
import type { CloudAccount, ScanResult } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDuration, formatTimeAgo } from "@/lib/utils";
import { Play, Loader2, AlertTriangle, History, Shield, Database, CheckCircle2, Clock } from "lucide-react";

interface ScanControlsProps {
  account: CloudAccount | null;
  scanStatus: ScanResult | null;
  history: ScanResult[];
  isLoading: boolean;
  includeProwler: boolean;
  onToggleProwler: () => void;
  onRunScan: () => void;
}

export function ScanControls({
  account,
  scanStatus,
  history,
  isLoading,
  includeProwler,
  onToggleProwler,
  onRunScan,
}: ScanControlsProps) {
  const isRunning = isLoading || scanStatus?.status === "running";

  if (!account) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p>Select an account to run scans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Scan Banner */}
      {isRunning && (
        <div className="bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-emerald-500/10 border border-amber-300/60 rounded-xl p-5 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-lg text-amber-700 shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  Security Scan in Progress
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800">
                  {scanStatus?.scan_type === "full" ? "Prowler + Inventory" : "Resource Discovery"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Auditing AWS resources in {account.regions.join(", ")}. You can leave this tab; the scan will complete in the background.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scan Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Scan Configuration</h3>
        <p className="text-xs text-slate-500 mb-4">
          Configure scan depth for account <span className="font-medium text-slate-800">{account.name}</span> ({account.account_id}).
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-600" />
                <h4 className="text-sm font-medium text-slate-800">Prowler Compliance Audit</h4>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Run 300+ compliance checks (CIS Benchmarks, SOC2, HIPAA, PCI-4.0, NIST 800-53, ISO 27001).
                When disabled, runs fast resource inventory discovery only.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeProwler}
                onChange={onToggleProwler}
                disabled={isRunning}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>

          <button
            onClick={onRunScan}
            disabled={isRunning}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running Security Scan...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> Start {includeProwler ? "Full Compliance Scan" : "Resource Discovery Scan"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scan History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Scan History</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {history.length} {history.length === 1 ? "record" : "records"}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No previous scans found for this account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Scan Type</th>
                  <th className="px-6 py-3">Started</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Resources</th>
                  <th className="px-6 py-3">Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((scan) => (
                  <tr key={scan.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={scan.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {scan.scan_type === "full" ? "Full Compliance" : "Resources Only"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {formatTimeAgo(scan.started_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {scan.finished_at ? formatDuration(scan.started_at, scan.finished_at) : "In progress"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-medium">
                      {scan.resources_scanned || "--"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-semibold ${scan.findings_count > 0 ? "text-amber-600" : "text-slate-700"}`}>
                        {scan.findings_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
