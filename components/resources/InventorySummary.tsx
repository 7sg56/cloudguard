import type { ServiceSummary } from "@/lib/types";
import { getServiceDisplayName } from "@/lib/utils";
import { Server, Globe, Lock, Layers } from "lucide-react";

export function InventorySummary({ summary }: { summary: ServiceSummary[] }) {
  const totalResources = summary.reduce((acc, s) => acc + s.count, 0);
  const totalPublic = summary.reduce((acc, s) => acc + s.public_count, 0);
  const totalUnencrypted = summary.reduce((acc, s) => acc + s.unencrypted_count, 0);
  const totalServices = summary.length;

  const cards = [
    { label: "Total Resources", value: totalResources, icon: Server, color: "text-blue-600 bg-blue-50" },
    { label: "Public Exposure", value: totalPublic, icon: Globe, color: totalPublic > 0 ? "text-red-600 bg-red-50" : "text-emerald-600 bg-emerald-50" },
    { label: "Unencrypted", value: totalUnencrypted, icon: Lock, color: totalUnencrypted > 0 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50" },
    { label: "Services", value: totalServices, icon: Layers, color: "text-indigo-600 bg-indigo-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{card.value}</div>
                <div className="text-xs text-slate-500 font-medium">{card.label}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
