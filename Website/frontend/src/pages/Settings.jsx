import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useCurrency } from "../lib/currency";
import { SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import { Check, RefreshCw, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export default function Settings() {
  const [cloud, setCloud] = useState(null);
  const { current: currency, available: currencies, refresh: refreshCurrency, format } = useCurrency();
  const [savingCurrency, setSavingCurrency] = useState(false);

  const fetchAll = async () => {
    const c = await api.get("/settings/cloud-sync");
    setCloud(c.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateCurrency = async (code) => {
    if (code === currency.code) return;
    setSavingCurrency(true);
    try {
      await api.put("/settings/currency", { currency_code: code });
      await refreshCurrency();
      window.dispatchEvent(new Event("spotytags:currency_updated"));
      const sel = currencies.find((c) => c.code === code);
      toast.success("Currency updated", { description: `${sel?.name || code} (${sel?.symbol || ""})` });
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail?.message || e.response?.data?.detail || e.message });
    } finally {
      setSavingCurrency(false);
    }
  };

  const triggerSync = async () => {
    try {
      const { data } = await api.post("/settings/cloud-sync/trigger");
      const synced = data.synced ?? 0;
      const failed = data.failed ?? 0;
      if (failed > 0) {
        toast.warning(`Synced ${synced}, ${failed} failed — will retry`);
      } else {
        toast.success(synced > 0 ? `Synced ${synced} events` : "Already in sync");
      }
      fetchAll();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  const retryDead = async () => {
    try {
      const { data } = await api.post("/cloud/retry-failed");
      toast.success(`Requeued ${data.requeued} for retry`);
      fetchAll();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  if (!cloud) return <div className="space-y-3"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;

  return (
    <div className="space-y-14">
      <SectionHeader
        overline="Settings · the house style"
        title={<>The configuration,<br /><span className="italic text-brand">at hand.</span></>}
        lead="A little orchestra of decisions: the theme, the sync schedule, the local server's quiet hum."
      />

      {/* Currency & locale */}
      <section data-testid="currency-settings-card">
        <p className="smallcaps mb-3 flex items-center gap-2">
          <Globe className="w-3 h-3" /> Currency & locale
        </p>
        <p className="font-display-text italic text-ink-600 mb-6">
          The folio, the dashboard, every receipt — all rewritten in your guest's mother tongue of money.
        </p>
        <div className="hairline mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-12 gap-y-6 mb-6">
          <div>
            <p className="smallcaps">Current</p>
            <p className="text-4xl font-bold tracking-display-tight mt-2 tabular">
              <span className="mr-2 text-brand">{currency.symbol}</span>{currency.code}
            </p>
            <p className="smallcaps text-ink-400 mt-1">{currency.name}</p>
          </div>
          <div>
            <p className="smallcaps">Preview</p>
            <p className="text-2xl font-display italic mt-3 tabular">{format(1234567.89)}</p>
            <p className="smallcaps text-ink-400 font-mono mt-1">locale · {currency.locale}</p>
          </div>
          <div>
            <p className="smallcaps">Decimals</p>
            <p className="text-2xl font-display italic mt-3 tabular">{currency.decimals}</p>
            <p className="smallcaps text-ink-400 mt-1">{currency.decimals === 0 ? "whole units only" : "two-place precision"}</p>
          </div>
        </div>

        <p className="smallcaps mb-3">Switch currency</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5" data-testid="currency-grid">
          {currencies.map((c) => {
            const selected = c.code === currency.code;
            return (
              <button
                key={c.code}
                onClick={() => updateCurrency(c.code)}
                disabled={savingCurrency}
                data-testid={`currency-${c.code}`}
                className={cn(
                  "relative flex items-baseline justify-between gap-2 px-4 py-3 rounded-xl border text-left transition-all",
                  selected
                    ? "bg-ink-900 text-cream border-ink-900 shadow-apple-sm"
                    : "bg-white border-hairline hover:border-ink-900 hover:shadow-apple-sm",
                )}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className={cn("text-xl font-bold tabular tracking-tighter-apple", selected ? "text-brand" : "text-ink-900")}>{c.symbol}</span>
                  <span className={cn("smallcaps font-mono", selected ? "!text-white" : "text-ink-900")}>{c.code}</span>
                </span>
                <span className="text-xs opacity-70 truncate hidden sm:inline">{c.name.split(" ")[0]}</span>
                {selected && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Cloud sync */}
      <section data-testid="cloud-sync-settings-card">
        <p className="smallcaps mb-3">Cloud sync</p>
        <p className="font-display-text italic text-ink-600 mb-6">The system writes everything locally. When the line is up, it whispers the same to the cloud.</p>
        <div className="hairline mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-6 mb-8">
          <div>
            <p className="smallcaps">Status</p>
            <p className={cn("ticking-num text-4xl mt-2", cloud.online ? "text-status-success" : "text-oxblood")}>
              {cloud.online ? "Online" : "Offline"}
            </p>
            {cloud.last_error && (
              <p className="text-xs text-oxblood mt-1 leading-tight max-w-xs truncate" title={cloud.last_error}>
                {cloud.last_error}
              </p>
            )}
          </div>
          <div>
            <p className="smallcaps">Pending</p>
            <p className="ticking-num text-4xl text-ink-900 mt-2 tabular">{cloud.pending_count}</p>
            <p className="smallcaps text-ink-400 mt-1">events queued</p>
          </div>
          <div>
            <p className="smallcaps">Failed</p>
            <p className={cn("ticking-num text-4xl mt-2 tabular",
              (cloud.failed_count || cloud.dead_letter_count) ? "text-amber-700" : "text-ink-400")}
            >
              {(cloud.failed_count || 0) + (cloud.dead_letter_count || 0)}
            </p>
            <p className="smallcaps text-ink-400 mt-1">awaiting retry</p>
          </div>
          <div>
            <p className="smallcaps">Last sync</p>
            <p className="font-display text-xl italic mt-2">{cloud.last_sync_at ? new Date(cloud.last_sync_at).toLocaleString() : "Never"}</p>
            <p className="smallcaps text-ink-400 mt-1 font-mono">every {cloud.interval_sec || 30}s</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={triggerSync} className="smallcaps ink-link text-ink-900 flex items-center gap-2" data-testid="trigger-sync-button">
            <RefreshCw className="w-3 h-3" /> Sync now
          </button>
          {(cloud.dead_letter_count || 0) > 0 && (
            <button onClick={retryDead} className="smallcaps ink-link text-amber-700 flex items-center gap-2" data-testid="retry-dead-letters">
              <RefreshCw className="w-3 h-3" /> Retry {cloud.dead_letter_count} dead-letter
            </button>
          )}
        </div>
      </section>

      {/* Local server */}
      <section data-testid="local-server-card">
        <p className="smallcaps mb-3">Local server</p>
        <p className="font-display-text italic text-ink-600 mb-6">The little box on the back-of-house counter. It never sleeps.</p>
        <div className="hairline mb-8" />
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-6">
          <li><p className="smallcaps">Process</p><p className="font-display text-xl italic mt-1 text-status-success">● Online</p></li>
          <li><p className="smallcaps">Storage</p><p className="font-display text-xl italic mt-1">MongoDB</p></li>
          <li><p className="smallcaps">Realtime</p><p className="font-display text-xl italic mt-1">WebSocket</p></li>
          <li><p className="smallcaps">Mode</p><p className="font-display text-xl italic mt-1">Hybrid</p></li>
        </ul>
      </section>
    </div>
  );
}
