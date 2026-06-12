import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useBranding } from "../lib/branding";
import { SectionHeader } from "../components/Editorial";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/ui/skeleton";
import { Check, X, Calendar } from "lucide-react";
import { cn } from "../lib/utils";

export default function License() {
  const [lic, setLic] = useState(null);
  const { hotel_name } = useBranding();

  const fetchAll = async () => {
    const a = await api.get("/license/current");
    setLic(a.data);
  };

  useEffect(() => { fetchAll(); }, []);

  if (!lic) return <div className="space-y-3"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;

  const expiry = new Date(lic.expiry_date);
  const features = [
    { key: "android_enabled", label: "Android workflow" },
    { key: "reports_enabled", label: "Advanced reports" },
    { key: "theme_customization_enabled", label: "Theme customization" },
    { key: "pms_enabled", label: "PMS integration" },
    { key: "cloud_sync_enabled", label: "Cloud sync" },
    { key: "offline_mode_enabled", label: "Offline mode" },
    { key: "auto_billing_enabled", label: "Auto billing" },
  ];

  return (
    <div className="space-y-14">
      <SectionHeader
        overline="License · Subscription"
        title={<>Your license,<br /><span className="italic text-brand">on paper.</span></>}
        lead="The terms, the limits, the days remaining — written like a contract, kept honest by the system."
      />

      {/* Current license — document feel */}
      <section data-testid="current-license-card">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 bg-white border border-hairline p-10 lg:p-14">
          <div className="lg:col-span-7">
            <p className="smallcaps mb-2">Property · {lic.property_id}</p>
            <h2 className="font-display text-4xl lg:text-5xl font-medium tracking-display-tight">{hotel_name}</h2>
            <p className="font-display-text italic text-ink-600 mt-1">{lic.hotel_group || `${hotel_name} Group`}</p>
            <p className="font-mono text-xs text-ink-400 mt-2 tracking-wider">{lic.license_key}</p>
            <div className="hairline my-6" />
            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
              <div><p className="smallcaps">Plan</p><p className="font-display text-2xl italic capitalize">{lic.plan}</p></div>
              <div><p className="smallcaps">Status</p><div className="mt-1"><StatusBadge status={lic.status} /></div></div>
              <div><p className="smallcaps">Expires</p><p className="font-display text-2xl italic flex items-center gap-2"><Calendar className="w-4 h-4" />{expiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
              <div><p className="smallcaps">Remaining</p><p className="font-display text-2xl italic tabular">{lic.days_remaining} days</p></div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <p className="smallcaps mb-3 mt-8">Features included</p>
            <div className="hairline mb-3" />
            <ul className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              {features.map((f) => (
                <li key={f.key} className="flex items-baseline gap-2">
                  {lic[f.key] ? <Check className="w-3 h-3 text-status-success" /> : <X className="w-3 h-3 text-ink-400" />}
                  <span className={!lic[f.key] ? "text-ink-400 line-through" : ""}>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
