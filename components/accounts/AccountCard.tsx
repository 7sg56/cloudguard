"use client";

import type { CloudAccount } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { Cloud, MapPin, Trash2, Edit3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AccountCardProps {
  account: CloudAccount;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AccountCard({
  account,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: AccountCardProps) {
  const statusColors: Record<string, string> = {
    connected: "bg-emerald-500",
    pending: "bg-amber-500",
    error: "bg-red-500",
    disconnected: "bg-slate-400",
  };

  return (
    <Card
      onClick={onSelect}
      className={`cursor-pointer transition-all ${
        isSelected
          ? "border-slate-900 ring-1 ring-slate-900"
          : "hover:border-slate-300"
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 bg-slate-100 rounded-md shrink-0">
              <Cloud className="w-4 h-4 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{account.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{account.account_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${statusColors[account.status || "pending"]}`} />
            <span className="text-[11px] text-slate-500 capitalize">{account.status || "pending"}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium capitalize">
              {account.environment}
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-400 uppercase">
              {account.provider || "AWS"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{(account.regions || []).join(", ") || "None"}</span>
          </div>

          <div className="text-[11px] text-slate-400 pt-1">
            Last scan: {formatTimeAgo(account.last_scan_at)}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-900"
            title="Edit account"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
            title="Delete account"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
