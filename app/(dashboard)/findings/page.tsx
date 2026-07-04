"use client";

import { useState, useCallback } from "react";
import { useAccountContext } from "@/context/AccountContext";
import { FindingsTable } from "@/components/findings/FindingsTable";
import { RemediationPanel } from "@/components/findings/RemediationPanel";
import type { Finding } from "@/lib/types";
import { rescanFinding } from "@/lib/api";
import { Shield } from "lucide-react";

export default function FindingsPage() {
  const { selectedAccount, loading } = useAccountContext();
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [updatedFinding, setUpdatedFinding] = useState<Finding | null>(null);
  const [rescanLoading, setRescanLoading] = useState(false);

  const handleRescan = useCallback(async (finding: Finding) => {
    setRescanLoading(true);
    try {
      const updated = await rescanFinding(finding.id);
      setSelectedFinding(updated);
      setUpdatedFinding(updated);
    } catch (err) {
      console.error("Rescan failed:", err);
    } finally {
      setRescanLoading(false);
    }
  }, []);

  const handleFindingUpdate = useCallback((updated: Finding) => {
    setSelectedFinding(updated);
    setUpdatedFinding(updated);
  }, []);

  if (loading) {
    return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;
  }

  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Shield className="w-16 h-16 mb-4 text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-600 mb-2">No account selected</h2>
        <p className="text-sm">Select an account to view security findings.</p>
      </div>
    );
  }

  return (
    <>
      <FindingsTable
        accountId={selectedAccount.id}
        onSelectFinding={setSelectedFinding}
        updatedFinding={updatedFinding}
      />
      <RemediationPanel
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onRescan={handleRescan}
        onFindingUpdate={handleFindingUpdate}
        rescanLoading={rescanLoading}
      />
    </>
  );
}
