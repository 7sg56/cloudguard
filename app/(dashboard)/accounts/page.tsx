"use client";

import { useState } from "react";
import { useAccountContext } from "@/context/AccountContext";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AddAccountForm } from "@/components/accounts/AddAccountForm";
import { EditAccountForm } from "@/components/accounts/EditAccountForm";
import { Toast } from "@/components/ui/Toast";
import type { CloudAccount } from "@/lib/types";
import { Plus, AlertCircle, AlertTriangle } from "lucide-react";

export default function AccountsPage() {
  const {
    accounts,
    selectedAccountId,
    selectAccount,
    addAccount,
    editAccount,
    removeAccount,
    loading,
  } = useAccountContext();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CloudAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<CloudAccount | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleEditSubmit = async (data: {
    name: string;
    role_arn: string;
    environment: string;
    regions: string;
  }) => {
    if (!editingAccount) return;
    await editAccount(editingAccount.id, data);
    setToast(`Account "${data.name}" updated successfully.`);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    try {
      await removeAccount(deletingAccount.id);
      setToast(`Account "${deletingAccount.name}" deleted.`);
    } finally {
      setDeletingAccount(null);
    }
  };

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
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AWS Accounts</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your connected cloud environments and scanning configurations.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-8">
          <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">No accounts configured</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Add your AWS account ID and IAM Role ARN to begin continuous security auditing and inventory tracking.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Connect AWS Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isSelected={account.id === selectedAccountId}
              onSelect={() => selectAccount(account.id)}
              onEdit={() => setEditingAccount(account)}
              onDelete={() => setDeletingAccount(account)}
            />
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddForm && (
        <AddAccountForm
          onSubmit={async (data) => {
            await addAccount(data);
            setToast(`Account "${data.name}" added successfully.`);
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <EditAccountForm
          account={editingAccount}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-50 rounded-full text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete AWS Account?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Are you sure you want to remove <span className="font-semibold text-slate-800">{deletingAccount.name}</span> ({deletingAccount.account_id})? This will delete associated findings and resource inventory.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
