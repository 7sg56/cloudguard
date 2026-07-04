"use client";

import { useState, useCallback } from "react";
import { useAccountContext } from "@/context/AccountContext";
import { ScanControls } from "@/components/scans/ScanControls";
import { triggerScan } from "@/lib/api";
import { Shield } from "lucide-react";

export default function ScansPage() {
  const { selectedAccount, scanStatus, updateScanStatus, loading } = useAccountContext();
  const [isLoading, setIsLoading] = useState(false);
  const [includeProwler, setIncludeProwler] = useState(true);

  const handleRunScan = useCallback(async () => {
    if (!selectedAccount) return;
    setIsLoading(true);
    try {
      const scan = await triggerScan(selectedAccount.account_id, includeProwler);
      updateScanStatus(selectedAccount.id, scan);
    } catch (err) {
      console.error("Failed to trigger scan:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccount, includeProwler, updateScanStatus]);

  if (loading) {
    return <div className="animate-pulse h-64 bg-slate-100 rounded-xl" />;
  }

  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Shield className="w-16 h-16 mb-4 text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-600 mb-2">No account selected</h2>
        <p className="text-sm">Select an account to run security scans.</p>
      </div>
    );
  }

  return (
    <ScanControls
      account={selectedAccount}
      scanStatus={scanStatus[selectedAccount.id] || null}
      isLoading={isLoading}
      includeProwler={includeProwler}
      onToggleProwler={() => setIncludeProwler(!includeProwler)}
      onRunScan={handleRunScan}
    />
  );
}
