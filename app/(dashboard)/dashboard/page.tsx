"use client";

import { useState } from "react";
import { useAccountContext } from "@/context/AccountContext";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RemediationPanel } from "@/components/findings/RemediationPanel";
import { rescanFinding } from "@/lib/api";
import type { Finding } from "@/lib/types";
import { Shield } from "lucide-react";

export default function DashboardPage() {
  const { selectedAccount, loading } = useAccountContext();
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [rescanLoading, setRescanLoading] = useState(false);

  const handleRescan = async (finding: Finding) => {
    setRescanLoading(true);
    try {
      const updated = await rescanFinding(finding.id);
      setSelectedFinding(updated);
    } catch (err) {
      console.error("Rescan failed:", err);
    } finally {
      setRescanLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Shield className="w-16 h-16 mb-4 text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-600 mb-2">No account selected</h2>
        <p className="text-sm">Add an AWS account or select one from the dropdown to view security insights.</p>
      </div>
    );
  }

  return (
    <>
      <DashboardStats
        accountId={selectedAccount.id}
        onSelectFinding={setSelectedFinding}
      />
      <RemediationPanel
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onRescan={handleRescan}
        onFindingUpdate={setSelectedFinding}
        rescanLoading={rescanLoading}
      />
    </>
  );
}
