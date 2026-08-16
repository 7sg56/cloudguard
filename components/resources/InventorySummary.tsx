import type { ServiceSummary } from "@/lib/types";
import { Server, Globe, Lock, Layers, ShieldAlert, ShieldCheck } from "lucide-react";

export function InventorySummary({ summary }: { summary: ServiceSummary[] }) {
  const totalResources = summary.reduce((acc, s) => acc + s.count, 0);
  const totalPublic = summary.reduce((acc, s) => acc + s.public_count, 0);
  const totalUnencrypted = summary.reduce((acc, s) => acc + s.unencrypted_count, 0);
  const totalServices = summary.length;

  const cards = [
    {
      label: "Total Cloud Assets",
      value: totalResources,
      icon: Server,
      color: "text-blue-600 bg-blue-50 border-blue-200/60",
      description: "Across monitored AWS regions",
    },
    {
      label: "Public Exposure",
      value: totalPublic,
      icon: Globe,
      color:
        totalPublic > 0
          ? "text-rose-600 bg-rose-50 border-rose-200/60"
          : "text-emerald-600 bg-emerald-50 border-emerald-200/60",
      description: totalPublic > 0 ? "Internet accessible assets" : "Zero internet exposed assets",
    },
    {
      label: "Unencrypted Storage",
      value: totalUnencrypted,
      icon: Lock,
      color:
        totalUnencrypted > 0
          ? "text-amber-600 bg-amber-50 border-amber-200/60"
          : "text-emerald-600 bg-emerald-50 border-emerald-200/60",
      description: totalUnencrypted > 0 ? "Missing KMS / SSE encryption" : "All data stores encrypted",
    },
    {
      label: "Active Services",
      value: totalServices,
      icon: Layers,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200/60",
      description: "S3, EC2, VPC, IAM, RDS, etc.",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg border ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{card.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{card.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
