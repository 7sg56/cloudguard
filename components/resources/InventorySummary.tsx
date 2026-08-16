import type { ServiceSummary } from "@/lib/types";
import { Server, Globe, Lock, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InventorySummary({ summary }: { summary: ServiceSummary[] }) {
  const totalResources = summary.reduce((acc, s) => acc + s.count, 0);
  const totalPublic = summary.reduce((acc, s) => acc + s.public_count, 0);
  const totalUnencrypted = summary.reduce((acc, s) => acc + s.unencrypted_count, 0);
  const totalServices = summary.length;

  const cards = [
    {
      label: "Total Assets",
      value: totalResources,
      icon: Server,
      sub: "Monitored AWS resources",
    },
    {
      label: "Public Exposure",
      value: totalPublic,
      icon: Globe,
      sub: totalPublic > 0 ? "Internet accessible" : "No public exposure",
      highlight: totalPublic > 0 ? "text-rose-600" : "text-emerald-600",
    },
    {
      label: "Unencrypted",
      value: totalUnencrypted,
      icon: Lock,
      sub: totalUnencrypted > 0 ? "Missing encryption" : "All encrypted",
      highlight: totalUnencrypted > 0 ? "text-amber-600" : "text-emerald-600",
    },
    {
      label: "Services",
      value: totalServices,
      icon: Layers,
      sub: "Active AWS services",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.label}
              </CardTitle>
              <Icon className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold text-slate-900 ${card.highlight || ""}`}>
                {card.value}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
