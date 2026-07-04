import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BoolBadgeProps {
  value: boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
}

export function BoolBadge({ value, trueLabel = "Yes", falseLabel = "No" }: BoolBadgeProps) {
  if (value === null || value === undefined) {
    return (
      <Badge variant="outline" className="text-[10px] font-medium text-slate-400 border-slate-200 bg-slate-50">
        N/A
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-bold uppercase tracking-wide",
        value
          ? "bg-red-50 text-red-600 border-red-200"
          : "bg-emerald-50 text-emerald-600 border-emerald-200",
      )}
    >
      {value ? trueLabel : falseLabel}
    </Badge>
  );
}
