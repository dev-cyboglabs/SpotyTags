import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import { Search } from "lucide-react";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/audit?limit=200").then((r) => {
      setLogs(r.data);
      setLoading(false);
    });
  }, []);

  const filtered = q
    ? logs.filter((l) => `${l.action} ${l.description} ${l.actor_email || ""}`.toLowerCase().includes(q.toLowerCase()))
    : logs;

  // Group by date
  const groups = {};
  filtered.forEach((l) => {
    const d = new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    if (!groups[d]) groups[d] = [];
    groups[d].push(l);
  });

  return (
    <div className="space-y-10">
      <SectionHeader
        overline={`${logs.length} entries · synced to the cloud where possible`}
        title={<>The audit log,<br /><span className="italic text-brand">unedited.</span></>}
        lead="Every decision, every change, every tamper — recorded in the order it happened. The hotel's collective memory."
      />

      <div className="border-b border-hairline pb-4">
        <label className="smallcaps">Search</label>
        <div className="relative mt-2">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="action · description · actor"
            data-testid="audit-search"
            className="w-full bg-transparent border-0 outline-none py-2 pl-6 text-base font-display italic placeholder:text-ink-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="font-display-text italic text-ink-600 py-12">Nothing here yet. The pages are blank.</p>
      ) : (
        <div className="space-y-12">
          {Object.entries(groups).map(([date, items]) => (
            <section key={date}>
              <p className="smallcaps mb-2 text-ink-400">{date}</p>
              <div className="hairline mb-2" />
              <ul className="divide-y divide-hairline-soft">
                {items.map((l) => (
                  <li key={l.id} className="py-4 grid grid-cols-12 gap-4 items-baseline" data-testid={`audit-${l.id}`}>
                    <span className="col-span-2 lg:col-span-1 smallcaps text-ink-400 font-mono tabular">
                      {new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="col-span-3 lg:col-span-2 smallcaps text-ink-600 font-mono">{l.action}</span>
                    <div className="col-span-5 lg:col-span-7">
                      <p className="font-display text-base lg:text-lg leading-tight">{l.description}</p>
                      <p className="smallcaps text-ink-400 mt-0.5">{l.actor_email || "system"} · {l.entity_type}</p>
                    </div>
                    <span className={`col-span-2 text-right smallcaps font-mono ${l.sync_status === "synced" ? "text-status-success" : "text-status-warning"}`}>
                      {l.sync_status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
