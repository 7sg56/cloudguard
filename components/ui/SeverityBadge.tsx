import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const severityStyles: Record<string, string> = {
  critical: "bg-red-600 text-white border-red-700",
  high: "bg-orange-500 text-white border-orange-600",
  medium: "bg-amber-400 text-amber-900 border-amber-500/20",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  info: "bg-slate-100 text-slate-600 border-slate-200",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "uppercase tracking-wide font-bold text-[10px]",
        severityStyles[severity] || severityStyles.info,
      )}
    >
      {severity}
    </Badge>
  );
}
