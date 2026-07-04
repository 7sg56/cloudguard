import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const statusConfig: Record<string, { style: string; icon?: React.ReactNode; label: string }> = {
  running: {
    style: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "Running",
  },
  completed: {
    style: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: <CheckCircle className="w-3 h-3" />,
    label: "Completed",
  },
  failed: {
    style: "bg-red-100 text-red-700 border-red-200",
    icon: <XCircle className="w-3 h-3" />,
    label: "Failed",
  },
  pending: {
    style: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "Pending",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 uppercase tracking-wide font-bold text-[10px]", config.style)}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}
