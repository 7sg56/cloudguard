"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { AWS_REGIONS, ENVIRONMENTS } from "@/lib/constants";

interface AddAccountFormProps {
  onSubmit: (data: {
    account_id: string;
    name: string;
    role_arn: string;
    environment: string;
    regions: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function AddAccountForm({ onSubmit, onClose }: AddAccountFormProps) {
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [roleArn, setRoleArn] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["us-east-1"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !name || !roleArn || selectedRegions.length === 0) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        account_id: accountId,
        name,
        role_arn: roleArn,
        environment,
        regions: selectedRegions.join(","),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to add account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Add AWS Account</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">AWS Account ID</label>
            <input type="text" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="123456789012"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono" maxLength={12} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production Account"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IAM Role ARN</label>
            <input type="text" value={roleArn} onChange={(e) => setRoleArn(e.target.value)} placeholder="arn:aws:iam::123456789012:role/CSPMScanRole"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono" />
            <p className="text-xs text-slate-400 mt-1">The IAM role must allow SecurityAudit + ViewOnlyAccess with STS AssumeRole.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 capitalize">
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env} className="capitalize">{env}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Regions</label>
            <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg">
              {AWS_REGIONS.map((region) => (
                <label key={region} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={selectedRegions.includes(region)} onChange={() => toggleRegion(region)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  {region}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : "Add Account"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
