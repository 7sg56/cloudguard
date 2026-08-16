"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccountContext } from "@/context/AccountContext";
import { ScanControls } from "@/components/scans/ScanControls";
import { triggerScan, getScanStatus, getScanHistory } from "@/lib/api";
import type { ScanResult } from "@/lib/types";
import { Shield } from "lucide-react";

export default function ScansPage() {
  const {
    selectedAccount,
    scanStatus,
    updateScanStatus,
    refreshAccounts,
    loading,
  } = useAccountContext();

  const [isLoading, setIsLoading] = useState(false);
  const [includeProwler, setIncludeProwler] = useState(true);
  const [history, setHistory] = useState<ScanResult[]>([]);

  const currentScan = selectedAccount ? scanStatus[selectedAccount.id] : null;

  const fetchHistory = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      const scans = await getScanHistory(selectedAccount.account_id);
      setHistory(scans);
    } catch (err) {
      console.error("Failed to fetch scan history:", err);
    }
  }, [selectedAccount]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Poll scan status while running
  useEffect(() => {
    if (!currentScan || currentScan.status !== "running" || !selectedAccount) return;

    const interval = setInterval(async () => {
      try {
        const updated = await getScanStatus(currentScan.id);
        updateScanStatus(selectedAccount.id, updated);
        if (updated.status === "completed" || updated.status === "failed") {
          refreshAccounts();
          fetchHistory();
        }
      } catch (err) {
        console.error("Failed to poll scan status:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentScan, selectedAccount, updateScanStatus, refreshAccounts, fetchHistory]);

  const handleRunScan = useCallback(async () => {
    if (!selectedAccount) return;
    setIsLoading(true);
    try {
      const scan = await triggerScan(selectedAccount.account_id, includeProwler);
      updateScanStatus(selectedAccount.id, scan);
      fetchHistory();
    } catch (err) {
      console.error("Failed to trigger scan:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccount, includeProwler, updateScanStatus, fetchHistory]);

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
      scanStatus={currentScan || null}
      history={history}
      isLoading={isLoading}
      includeProwler={includeProwler}
      onToggleProwler={() => setIncludeProwler(!includeProwler)}
      onRunScan={handleRunScan}
    />
  );
}
