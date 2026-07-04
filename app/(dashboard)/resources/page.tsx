"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccountContext } from "@/context/AccountContext";
import { ResourceTable } from "@/components/resources/ResourceTable";
import { InventorySummary } from "@/components/resources/InventorySummary";
import type { CloudResource, ServiceSummary } from "@/lib/types";
import { getResources, getResourceSummary } from "@/lib/api";
import { Shield } from "lucide-react";

export default function ResourcesPage() {
  const { selectedAccount, loading: accountLoading } = useAccountContext();
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [summary, setSummary] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const [res, sum] = await Promise.all([
        getResources(selectedAccount.account_id),
        getResourceSummary(selectedAccount.account_id),
      ]);
      setResources(res);
      setSummary(sum);
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (accountLoading) {
    return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />;
  }

  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Shield className="w-16 h-16 mb-4 text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-600 mb-2">No account selected</h2>
        <p className="text-sm">Select an account to view cloud resources.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InventorySummary summary={summary} />
      <ResourceTable resources={resources} loading={loading} />
    </div>
  );
}
