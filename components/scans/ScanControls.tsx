"use client";

import type { CloudAccount, ScanResult } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDuration } from "@/lib/utils";
import { Play, Loader2, AlertTriangle } from "lucide-react";

interface ScanControlsProps {
  account: CloudAccount | null;
  scanStatus: ScanResult | null;
  isLoading: boolean;
  includeProwler: boolean;
  onToggleProwler: () => void;
  onRunScan: () => void;
}

export function ScanControls({
  account,
  scanStatus,
  isLoading,
  includeProwler,
  onToggleProwler,
  onRunScan,
}: ScanControlsProps) {
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
      {/* Scan Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Scan Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <h4 className="text-sm font-medium text-slate-800">Prowler Compliance Scan</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Run a full compliance scan using Prowler (CIS, SOC2, PCI-DSS, HIPAA, NIST 800-53).
                This may take 15-30 minutes.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={includeProwler} onChange={onToggleProwler} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>

          <button
            onClick={onRunScan}
            disabled={isLoading || scanStatus?.status === "running"}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading || scanStatus?.status === "running" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
            ) : (
              <><Play className="w-4 h-4" /> Run Scan</>
            )}
          </button>
        </div>
      </div>

      {/* Scan Result */}
      {scanStatus && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Latest Scan</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Status</span>
              <StatusBadge status={scanStatus.status} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Started</span>
              <span className="text-slate-900 font-medium">{formatDate(scanStatus.started_at)}</span>
            </div>
            {scanStatus.finished_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Duration</span>
                <span className="text-slate-900 font-medium">{formatDuration(scanStatus.started_at, scanStatus.finished_at)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Findings</span>
              <span className="text-slate-900 font-bold">{scanStatus.findings_count}</span>
            </div>
            {scanStatus.error_message && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {scanStatus.error_message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
