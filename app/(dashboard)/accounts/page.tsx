"use client";

import { useState } from "react";
import { useAccountContext } from "@/context/AccountContext";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AddAccountForm } from "@/components/accounts/AddAccountForm";
import { Plus } from "lucide-react";

export default function AccountsPage() {
  const { accounts, selectedAccountId, selectAccount, addAccount, removeAccount, loading } = useAccountContext();
  const [showAddForm, setShowAddForm] = useState(false);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">AWS Accounts</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No accounts configured</p>
          <p className="text-sm">Add an AWS account to start scanning for security issues.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isSelected={account.id === selectedAccountId}
              onSelect={() => selectAccount(account.id)}
              onDelete={() => removeAccount(account.id)}
            />
          ))}
        </div>
      )}

      {showAddForm && (
        <AddAccountForm
          onSubmit={addAccount}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
