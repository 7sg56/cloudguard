"use client";

import type { CloudAccount } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { Cloud, MapPin, Trash2 } from "lucide-react";

interface AccountCardProps {
  account: CloudAccount;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function AccountCard({ account, isSelected, onSelect, onDelete }: AccountCardProps) {
  const statusColors: Record<string, string> = {
    connected: "bg-emerald-500",
    pending: "bg-amber-500",
    error: "bg-red-500",
    disconnected: "bg-slate-400",
  };

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-xl border shadow-sm p-5 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColors[account.status || "pending"]}`} />
        <span className="text-xs text-slate-500 capitalize">{account.status || "pending"}</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="p-2 bg-slate-50 rounded-lg">
          <Cloud className="w-5 h-5 text-slate-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{account.name}</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{account.account_id}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium capitalize">
            {account.environment}
          </span>
          <span className="text-slate-300">|</span>
          <span className="uppercase font-semibold text-slate-400">{account.provider || "AWS"}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3 h-3" />
          <span>{account.regions.join(", ")}</span>
        </div>

        <div className="text-xs text-slate-400">
          Last scan: {formatTimeAgo(account.last_scan_at)}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute bottom-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        title="Delete account"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
