import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useEventListener } from "../lib/realtime";
import { useAuth } from "../lib/auth";
import { useCurrency } from "../lib/currency";
import { useBranding, absoluteBrandUrl } from "../lib/branding";
import { Link } from "react-router-dom";
import { EditorialMetric, SectionHeader, Surface } from "../components/Editorial";
import { StatusDot } from "../components/StatusBadge";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "sonner";
import { ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

function KVRow({ label, value, accent }) {
  return (
    <div className="flex items-baseline justify-between py-3 border-b border-hairline-soft last:border-0">
      <span className="smallcaps text-ink-500">{label}</span>
      <span className={cn("text-base font-semibold tracking-tighter-apple text-ink-900 tabular", accent && "text-brand")}>{value}</span>
    </div>
  );
}

function getRevenueFontSize(formattedAmount) {
  const length = formattedAmount.length;
  if (length <= 8) return "clamp(2rem, 6vw, 3rem)";
  if (length <= 10) return "clamp(1.75rem, 5vw, 2.5rem)";
  if (length <= 12) return "clamp(1.5rem, 4vw, 2rem)";
  return "clamp(1.25rem, 3vw, 1.75rem)";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { format, symbol } = useCurrency();
  const { hotel_name, logo_url, website } = useBranding();
  const [kpi, setKpi] = useState(null);
  const [recent, setRecent] = useState({ audits: [], events: [] });
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api.get("/dashboard/kpi"),
        api.get("/dashboard/recent"),
      ]);
      setKpi(a.data);
      setRecent(b.data);
    } catch (err) {
      console.warn("Failed to load dashboard data:", err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 20000);
    return () => clearInterval(t);
  }, [fetchAll]);

  useEventListener("tamper", fetchAll);
  useEventListener("billing_updated", fetchAll);
  useEventListener("billing_created", fetchAll);

  const handleSimulate = async () => {
    try {
      setBusy(true);
      const { data: tags } = await api.get("/tags?status=active");
      if (!tags.length) {
        toast.error("No active tag found");
        return;
      }
      const tag = tags[Math.floor(Math.random() * tags.length)];
      await api.post("/demo/simulate-tamper", { tag_id: tag.id });
      toast.success("Tamper detected", { description: `${tag.tag_id} · Room ${tag.room_number}` });
      fetchAll();
    } catch (e) {
      toast.error("Simulation failed", { description: e.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  if (!kpi) return <div className="space-y-6"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div>;

  const licenseExpiry = new Date(kpi.license_expiry);
  const daysLeft = Math.floor((licenseExpiry - new Date()) / (1000 * 60 * 60 * 24));
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-12">
      {/* Editorial hero */}
      <section>
        <SectionHeader
          overline={`${greeting} · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`}
          title={
            <>
              <span className="flex items-center gap-3 mb-1">
                {logo_url && (
                  <img
                    src={absoluteBrandUrl(logo_url)}
                    alt="Logo"
                    className="h-16 w-16 lg:h-16 lg:w-16 object-contain rounded-xl border border-hairline-soft p-1 bg-white shrink-0 shadow-apple-sm"
                  />
                )}
                <span className="flex items-baseline gap-3">
                  <span>{hotel_name}</span>
                  {website && (
                    <a
                      href={website.startsWith("http://") || website.startsWith("https://") ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="smallcaps text-ink-500 hover:text-brand transition-colors flex items-center gap-1 text-xs"
                    >
                      Website
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </span>
              </span>
              <span className="accent-serif text-brand block mt-1">today.</span>
            </>
          }
          lead={`${user?.name ?? "Welcome"}. ${kpi.pending_bills} bill${kpi.pending_bills === 1 ? "" : "s"} awaiting review, ${kpi.confirmed_usage} confirmed, ${kpi.active_tags} tags listening.`}
          right={
            <div className="flex items-center gap-3">
              <button
                onClick={fetchAll}
                data-testid="refresh-dashboard"
                className="btn-apple btn-apple-secondary"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button
                onClick={handleSimulate}
                disabled={busy}
                data-testid="simulate-tamper-button"
                className="btn-apple btn-apple-primary"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Simulate Tamper
              </button>
            </div>
          }
        />

        {/* Hero revenue metric in elevated Surface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2 items-start">
          <Surface className="lg:col-span-6 self-start" padding="p-4">
            <p className="smallcaps mb-1">Revenue · Today</p>
            <p className="ticking-num text-ink-900" style={{ fontSize: getRevenueFontSize(format(kpi.today_revenue)) }}>
              {format(kpi.today_revenue)}
            </p>
            <div className="hairline-soft mt-1" />
            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3 mt-3">
              <div>
                <span className="smallcaps text-ink-400 block mb-0">Month-to-date</span>
                <span className="text-xl font-bold tracking-tighter-apple tabular">{format(kpi.monthly_revenue)}</span>
              </div>
              <div>
                <span className="smallcaps text-ink-400 block mb-0">Confirmed</span>
                <span className="text-xl font-bold tracking-tighter-apple tabular">{kpi.confirmed_usage}</span>
              </div>
              <div>
                <span className="smallcaps text-ink-400 block mb-0">Awaiting</span>
                <span className="text-xl font-bold tracking-tighter-apple tabular text-brand">{kpi.pending_bills} pending</span>
              </div>
            </div>
          </Surface>

          {/* Right: license card */}
          <div className="lg:col-span-6">
            <Surface className="self-start" padding="p-4" data-testid="license-card">
              <div className="flex items-center justify-between mb-2">
                <p className="smallcaps">License</p>
                <span className="flex items-center gap-1.5 text-xs font-semibold tabular text-ink-900">
                  <StatusDot status={kpi.license_status} />
                  {kpi.license_status.replace("_", " ")}
                </span>
              </div>
              <div className="hairline-soft" />
              <div className="mt-2">
                <KVRow label="Expires" value={licenseExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
                <KVRow label="Days remaining" value={daysLeft > 0 ? daysLeft : "—"} />
                <KVRow label="Plan" value="Professional" />
              </div>
              <Link to="/license" className="mt-3 inline-flex ink-link smallcaps text-ink-900" data-testid="manage-license-link">
                Manage license <ArrowUpRight className="w-3 h-3" />
              </Link>
            </Surface>
          </div>
        </div>
      </section>


      {/* Recent activity */}
      <section>
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tighter-apple">Recent activity</h2>
          <p className="text-sm text-ink-500">As it happens, across every workstation</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Surface className="lg:col-span-8" padding="p-8" data-testid="recent-activity-card">
            <ul className="divide-y divide-hairline-soft">
              {recent.audits.length === 0 && <li className="py-6 text-ink-500">A quiet shift so far.</li>}
              {recent.audits.slice(0, 8).map((a, i) => (
                <li key={a.id} className="py-4 flex items-baseline gap-5">
                  <span className="smallcaps text-ink-400 font-mono w-8 shrink-0">{(i + 1).toString().padStart(2, "0")}</span>
                  <span className="smallcaps text-ink-400 font-mono w-24 shrink-0 tabular">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium tracking-tighter-apple leading-tight">{a.description}</p>
                    <p className="text-xs text-ink-500 mt-1">{a.actor_email || "system"} · {a.action}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="lg:col-span-4" padding="p-8">
            <p className="smallcaps mb-4">Recent bills</p>
            <div className="hairline-soft mb-4" />
            <ul className="space-y-4">
              {recent.events.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between pb-3 border-b border-hairline-soft last:border-0 last:pb-0">
                  <span className="text-xl font-bold tabular text-brand">{format(e.selling_price)}</span>
                  <div className="text-right">
                    <p className="text-sm font-medium tracking-tighter-apple">{e.product_name}</p>
                    <p className="smallcaps text-ink-400">Room {e.room_number}</p>
                  </div>
                </li>
              ))}
              {recent.events.length === 0 && <li className="text-sm text-ink-500">Nothing yet.</li>}
            </ul>
          </Surface>
        </div>
      </section>
    </div>
  );
}
