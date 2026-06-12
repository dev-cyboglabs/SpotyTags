import { Link } from "react-router-dom";
import { AlertTriangle, ShieldAlert, ArrowUpRight, X } from "lucide-react";
import { useState } from "react";
import { useLicense } from "../lib/license";
import { cn } from "../lib/utils";

/**
 * Sticky banner shown above the topbar when the licence is expired/expiring
 * or any resource quota is approaching/exceeded. Multiple warnings collapse
 * into a single line with severity-tinted background.
 */
export function LicenseBanner() {
  const { warnings } = useLicense();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !warnings || warnings.length === 0) return null;

  // Pick the most severe warning to lead the banner
  const danger = warnings.find((w) => w.severity === "danger");
  const lead = danger || warnings[0];
  const extra = warnings.length - 1;
  const isDanger = lead.severity === "danger";

  return (
    <div
      data-testid="license-banner"
      className={cn(
        "sticky top-0 z-40 px-6 lg:px-12 py-2.5 flex items-center gap-3",
        "border-b backdrop-blur-xl",
        isDanger
          ? "bg-oxblood/[0.06] text-oxblood border-oxblood/30"
          : "bg-amber-500/[0.08] text-amber-900 border-amber-500/30"
      )}
    >
      {isDanger ? (
        <ShieldAlert className="w-4 h-4 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}
      <p className="text-sm font-medium tracking-tighter-apple flex-1 min-w-0 truncate">
        <span className="smallcaps mr-2">{isDanger ? "Action required" : "Heads up"}</span>
        {lead.message}
        {extra > 0 && (
          <span className="smallcaps ml-2 opacity-70">+{extra} more</span>
        )}
      </p>
      <Link
        to="/license"
        data-testid="license-banner-cta"
        className="smallcaps flex items-center gap-1 hover:underline whitespace-nowrap"
      >
        Manage <ArrowUpRight className="w-3 h-3" />
      </Link>
      <button
        onClick={() => setDismissed(true)}
        data-testid="license-banner-dismiss"
        className="opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default LicenseBanner;
