"use client";

import type { CloudAccount, ScanResult } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDuration, formatTimeAgo } from "@/lib/utils";
import { Play, Loader2, AlertTriangle, Shield, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      <Card className="p-8 text-center text-slate-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">Select an account to run scans.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Scan Indicator */}
      {isRunning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-amber-900">
              Security scan in progress:
            </span>{" "}
            <span className="text-amber-800">
              Auditing AWS account {account.name} ({account.account_id}). Results will update in background.
            </span>
          </div>
        </div>
      )}

      {/* Scan Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">
            Scan Configuration
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Configure scan depth for {account.name} ({account.account_id}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-md">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Prowler Compliance Scan
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-lg">
                Run compliance checks (CIS, SOC2, HIPAA, PCI, NIST). When disabled, runs fast resource inventory discovery only.
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
              <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-slate-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-slate-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>

          <Button
            onClick={onRunScan}
            disabled={isRunning}
            className="w-full h-9 text-xs font-medium"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Scanning AWS...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5" /> Start {includeProwler ? "Compliance & Inventory Scan" : "Inventory Scan"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-900">
            Scan History
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Historical audit runs for this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <Clock className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
              <p className="text-xs">No previous scans found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Started</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Assets</th>
                    <th className="px-4 py-2.5">Findings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((scan) => (
                    <tr key={scan.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={scan.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap capitalize text-slate-700">
                        {scan.scan_type === "full" ? "Compliance" : "Inventory"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatTimeAgo(scan.started_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {scan.finished_at ? formatDuration(scan.started_at, scan.finished_at) : "Running"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                        {scan.resources_scanned || "--"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                        {scan.findings_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
