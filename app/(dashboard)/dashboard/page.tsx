"use client";

import { useAccountContext } from "@/context/AccountContext";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { Shield } from "lucide-react";

export default function DashboardPage() {
  const { selectedAccount, loading } = useAccountContext();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-slate-100 rounded-xl" />
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

  return <DashboardStats accountId={selectedAccount.id} />;
}
