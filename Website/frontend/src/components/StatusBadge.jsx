import { cn } from "../lib/utils";

/**
 * Inline status indicator — Apple-style: subtle tinted pill + soft dot.
 * Cleaner than badges, more refined than just dots.
 */
const STATUS_CONFIG = {
  // Room status
  vacant: { label: "Vacant", fg: "#1F7A3D", bg: "rgba(31, 122, 61, 0.08)" },
  occupied: { label: "Occupied", fg: "#1A1A1A", bg: "rgba(26, 26, 26, 0.07)" },
  checkout_pending: { label: "Checkout Pending", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  cleaning: { label: "Cleaning", fg: "#3E2723", bg: "rgba(62, 39, 35, 0.08)" },
  maintenance: { label: "Maintenance", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  do_not_disturb: { label: "Do Not Disturb", fg: "#52504A", bg: "rgba(82, 80, 74, 0.10)" },
  // Tag status
  unassigned: { label: "Unassigned", fg: "#52504A", bg: "rgba(82, 80, 74, 0.08)" },
  assigned: { label: "Assigned", fg: "#1A1A1A", bg: "rgba(26, 26, 26, 0.07)" },
  active: { label: "Active", fg: "#1F7A3D", bg: "rgba(31, 122, 61, 0.10)" },
  tamper_triggered: { label: "Tamper", fg: "#8B2424", bg: "rgba(139, 36, 36, 0.10)" },
  low_battery: { label: "Low Battery", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  not_seen: { label: "Not Seen", fg: "#52504A", bg: "rgba(82, 80, 74, 0.08)" },
  faulty: { label: "Faulty", fg: "#8B2424", bg: "rgba(139, 36, 36, 0.10)" },
  lost: { label: "Lost", fg: "#8B2424", bg: "rgba(139, 36, 36, 0.10)" },
  retired: { label: "Retired", fg: "#52504A", bg: "rgba(82, 80, 74, 0.08)" },
  // Gateway
  online: { label: "Online", fg: "#1F7A3D", bg: "rgba(31, 122, 61, 0.10)" },
  offline: { label: "Offline", fg: "#8B2424", bg: "rgba(139, 36, 36, 0.10)" },
  weak_signal: { label: "Weak Signal", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  not_configured: { label: "Not Configured", fg: "#52504A", bg: "rgba(82, 80, 74, 0.08)" },
  needs_update: { label: "Needs Update", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  // Billing
  pending_review: { label: "Pending Review", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  confirmed: { label: "Confirmed", fg: "#1F7A3D", bg: "rgba(31, 122, 61, 0.10)" },
  added_to_bill: { label: "Added to Bill", fg: "#1F7A3D", bg: "rgba(31, 122, 61, 0.10)" },
  waived: { label: "Waived", fg: "#52504A", bg: "rgba(82, 80, 74, 0.08)" },
  disputed: { label: "Disputed", fg: "#8B2424", bg: "rgba(139, 36, 36, 0.10)" },
  complimentary: { label: "Complimentary", fg: "#3E2723", bg: "rgba(62, 39, 35, 0.08)" },
  cancelled: { label: "Cancelled", fg: "#52504A", bg: "rgba(82, 80, 74, 0.08)" },
  // License
  trial: { label: "Trial", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  expiring_soon: { label: "Expiring Soon", fg: "#B8860B", bg: "rgba(184, 134, 11, 0.10)" },
  expired: { label: "Expired", fg: "#8B2424", bg: "rgba(139, 36, 36, 0.10)" },
  suspended: { label: "Suspended", fg: "#8B2424", bg: "rgba(139, 36, 36, 0.10)" },
};

export function StatusBadge({ status, className, hideLabel = false, variant = "pill" }) {
  const cfg = STATUS_CONFIG[status] || { label: status, fg: "#52504A", bg: "rgba(82, 80, 74, 0.08)" };

  if (variant === "inline") {
    return (
      <span
        className={cn("inline-flex items-center gap-2 smallcaps whitespace-nowrap", className)}
        style={{ color: cfg.fg }}
        data-testid={`status-${status}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.fg }} />
        {!hideLabel && cfg.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap tracking-tighter-apple",
        className
      )}
      style={{ color: cfg.fg, backgroundColor: cfg.bg }}
      data-testid={`status-${status}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.fg }} />
      {!hideLabel && cfg.label}
    </span>
  );
}

export function StatusDot({ status, size = 8, className }) {
  const cfg = STATUS_CONFIG[status] || { fg: "#52504A" };
  return (
    <span
      className={cn("inline-block rounded-full shrink-0", className)}
      style={{ width: size, height: size, backgroundColor: cfg.fg }}
      data-testid={`status-dot-${status}`}
    />
  );
}

export default StatusBadge;
