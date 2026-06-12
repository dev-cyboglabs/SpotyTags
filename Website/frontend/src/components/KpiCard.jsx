import { cn } from "../lib/utils";

export function KpiCard({ title, value, subtext, icon: Icon, accent, testId }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-card border border-border rounded-2xl p-6 card-hover",
        "shadow-soft"
      )}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="font-heading text-3xl lg:text-4xl font-black tracking-tighter mt-2 text-foreground truncate">{value}</p>
          {subtext && <p className="text-sm text-muted-foreground mt-1">{subtext}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center",
              accent === "brand" && "bg-brand/10 text-brand",
              accent === "success" && "bg-emerald-50 text-emerald-600",
              accent === "warning" && "bg-amber-50 text-amber-600",
              accent === "danger" && "bg-red-50 text-red-600",
              accent === "info" && "bg-blue-50 text-blue-600",
              !accent && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export default KpiCard;
