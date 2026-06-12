import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { SectionHeader, Surface } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Search, Battery, BatteryMedium, BatteryLow, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";

function batteryIndicator(b) {
  if (b > 60) return { icon: Battery, color: "#1F7A3D" };
  if (b > 20) return { icon: BatteryMedium, color: "#B8860B" };
  return { icon: BatteryLow, color: "#8B2424" };
}

export default function Tags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const fetchTags = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/tags");
      setTags(data);
    } catch (err) { console.warn("Tags fetch failed:", err); }
    setLoading(false);
  };

  useEffect(() => { fetchTags(); }, []);

  const filtered = tags.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (q && !`${t.tag_id} ${t.ble_mac} ${t.product_name || ""} ${t.room_number || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const active = tags.filter(t => t.status === "active").length;
  const tampered = tags.filter(t => t.status === "tamper_triggered").length;

  return (
    <div className="space-y-10">
      <SectionHeader
        overline={`${tags.length} tags · ${active} listening · ${tampered} triggered`}
        title={<>Every cap has<br /><span className="accent-serif text-brand">a name.</span></>}
        lead="The tag whispers every fifteen seconds — battery, signal, seal. Here is what it has said today. Read-only inventory; field staff add and assign tags from the mobile app."
        right={
          <Link to="/mobile-app-download" className="btn-apple btn-apple-secondary text-xs" data-testid="open-mobile-app">
            <Smartphone className="w-3.5 h-3.5" />
            Open mobile app
          </Link>
        }
      />

      <Surface padding="p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-6 lg:gap-12 mb-6">
          <div className="flex-1">
            <label className="smallcaps">Search</label>
            <div className="relative mt-2">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ID · MAC · room · product"
                data-testid="tag-search-input"
                className="w-full bg-transparent border-0 border-b border-ink-200 focus:border-ink-900 outline-none py-2 pl-6 text-base font-medium tracking-tighter-apple placeholder:text-ink-400 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="smallcaps">Filter</label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="border-0 border-b border-ink-200 rounded-none px-0 text-base mt-2 font-semibold tracking-tighter-apple w-56" data-testid="tag-filter-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="tamper_triggered">Tamper</SelectItem>
                <SelectItem value="low_battery">Low battery</SelectItem>
                <SelectItem value="not_seen">Not seen</SelectItem>
                <SelectItem value="faulty">Faulty</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-ink-500 py-12">No tags match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">№</th>
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Tag ID</th>
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Product · Room</th>
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">BLE MAC</th>
                <th className="text-right smallcaps text-ink-400 pb-3 pr-4">Battery</th>
                <th className="text-right smallcaps text-ink-400 pb-3 pr-4">Signal</th>
                <th className="text-right smallcaps text-ink-400 pb-3 pr-4">Last Seen</th>
                <th className="text-left smallcaps text-ink-400 pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {filtered.map((t, i) => {
                const Bat = batteryIndicator(t.battery);
                return (
                  <tr key={t.id} className="hover:bg-cream-deep/30 transition-colors" data-testid={`tag-row-${t.tag_id}`}>
                    <td className="py-3 pr-4 smallcaps text-ink-400 font-mono">{(i + 1).toString().padStart(3, "0")}</td>
                    <td className="py-3 pr-4 font-mono text-base text-ink-900 font-semibold">{t.tag_id}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium tracking-tighter-apple">{t.product_name || "Unassigned"}</p>
                      {t.room_number && <p className="smallcaps text-ink-400 mt-0.5">Room {t.room_number}</p>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-500">{t.ble_mac}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className="inline-flex items-center gap-1.5 tabular text-sm font-semibold" style={{ color: Bat.color }}>
                        <Bat.icon className="w-3.5 h-3.5" /> {t.battery}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs text-ink-500 tabular">{t.rssi} dBm</td>
                    <td className="py-3 pr-4 text-right text-xs text-ink-500">{t.last_seen ? new Date(t.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="py-3"><StatusBadge status={t.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Surface>
    </div>
  );
}
