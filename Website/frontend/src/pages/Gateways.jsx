import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { SectionHeader, Surface } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Copy, Check, X, Smartphone, Search } from "lucide-react";
import { Link } from "react-router-dom";

function GatewayDetailDialog({ gw, onClose }) {
  const [detail, setDetail] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!gw) return;
    setReveal(false);
    api.get(`/gateways/${gw.id}`).then((r) => setDetail(r.data));
  }, [gw]);

  const copyKey = () => {
    if (!detail) return;
    navigator.clipboard.writeText(detail.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!gw) return null;
  return (
    <Dialog open={!!gw} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl">
        <button onClick={onClose} className="smallcaps ink-link text-ink-500 mb-6"><X className="w-3 h-3" /> Close</button>
        <DialogHeader>
          <DialogTitle asChild>
            <div className="flex items-baseline gap-6">
              <span className="ticking-num text-7xl">{gw.gateway_id.replace("GW-", "")}</span>
              <div>
                <p className="smallcaps">Gateway</p>
                <p className="text-xl font-semibold tracking-tighter-apple">{gw.gateway_id}</p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="hairline my-8" />
        {!detail ? <Skeleton className="h-40" /> : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div><p className="smallcaps mb-1">Status</p><StatusBadge status={detail.status} /></div>
              <div><p className="smallcaps mb-1">Room</p><p className="font-semibold tracking-tighter-apple text-lg">{detail.room_number || "—"}</p></div>
              <div><p className="smallcaps mb-1">MAC address</p><p className="font-mono text-xs">{detail.mac_address}</p></div>
              <div><p className="smallcaps mb-1">IP address</p><p className="font-mono text-xs">{detail.ip_address || "—"}</p></div>
              <div><p className="smallcaps mb-1">Firmware</p><p className="font-mono text-xs">{detail.firmware_version}</p></div>
              <div><p className="smallcaps mb-1">RSSI</p><p className="font-mono text-xs tabular">{detail.rssi} dBm</p></div>
            </div>

            <div>
              <p className="smallcaps mb-3">API key · ESP32 auth</p>
              <div className="hairline-soft mb-3" />
              <div className="bg-white border border-hairline rounded-xl shadow-apple-sm px-5 py-4 flex items-center justify-between gap-3">
                <code className="font-mono text-xs break-all flex-1" data-testid="gateway-api-key">
                  {reveal ? detail.api_key : "•".repeat(36)}
                </code>
                <button onClick={() => setReveal((r) => !r)} className="smallcaps ink-link text-ink-500">
                  {reveal ? "Hide" : "Reveal"}
                </button>
                <button onClick={copyKey} className="smallcaps ink-link text-ink-500" data-testid="copy-api-key">
                  {copied ? <Check className="w-3 h-3 text-status-success" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-xs text-ink-500 mt-3">Technicians use the mobile app to register new gateways and run diagnostics on this device.</p>
            </div>

            {detail.tags && detail.tags.length > 0 && (
              <div>
                <p className="smallcaps mb-3">Tags detected ({detail.tags.length})</p>
                <div className="hairline-soft mb-3" />
                <ul className="divide-y divide-hairline-soft">
                  {detail.tags.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-3">
                      <span className="font-mono text-xs">{t.tag_id}</span>
                      <span className="smallcaps text-ink-400 font-mono tabular">{t.battery}% · {t.rssi} dBm</span>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Gateways() {
  const [gws, setGws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const fetchGws = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/gateways");
      setGws(data);
    } catch (err) {
      console.warn("Failed to load gateways:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchGws(); }, [fetchGws]);

  const filtered = gws.filter((g) => {
    if (filter !== "all" && g.status !== filter) return false;
    if (q && !`${g.gateway_id} ${g.mac_address} ${g.room_number || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const online = gws.filter(g => g.status === "online").length;
  const offline = gws.filter(g => g.status === "offline").length;

  return (
    <div className="space-y-10">
      <SectionHeader
        overline={`${online} online · ${offline} offline · ${gws.length} total`}
        title={<>Gateways,<br /><span className="accent-serif text-brand">listening.</span></>}
        lead="ESP32s tucked behind the dado rail in every room — scanning Bluetooth advertisements, posting events to the local server. Technicians register and test gateways from the mobile app."
        right={
          <Link to="/mobile-app-download" className="btn-apple btn-apple-secondary text-xs" data-testid="open-mobile-app">
            <Smartphone className="w-3.5 h-3.5" />
            Open mobile app
          </Link>
        }
      />

      <Surface padding="p-6 lg:p-8" className="w-full max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-6 lg:gap-12 mb-6">
          <div className="flex-1">
            <label className="smallcaps">Search</label>
            <div className="relative mt-2">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Gateway ID · MAC · room"
                data-testid="gateway-search-input"
                className="w-full bg-transparent border-0 border-b border-ink-200 focus:border-ink-900 outline-none py-2 pl-6 text-base font-medium tracking-tighter-apple placeholder:text-ink-400 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="smallcaps">Filter</label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="border-0 border-b border-ink-200 rounded-none px-0 text-base mt-2 font-semibold tracking-tighter-apple w-56" data-testid="gateway-filter-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="weak_signal">Weak signal</SelectItem>
                <SelectItem value="not_configured">Not configured</SelectItem>
                <SelectItem value="needs_update">Needs update</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-ink-500 py-12">No gateways match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">№</th>
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Gateway ID</th>
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">MAC address</th>
                <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Room</th>
                <th className="text-right smallcaps text-ink-400 pb-3 pr-4">Signal</th>
                <th className="text-right smallcaps text-ink-400 pb-3 pr-4">Tags</th>
                <th className="text-left smallcaps text-ink-400 pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {filtered.map((gw, i) => (
                <tr key={gw.id} className="hover:bg-cream-deep/30 transition-colors" data-testid={`gateway-row-${gw.gateway_id}`}>
                  <td className="py-3 pr-4 smallcaps text-ink-400 font-mono">{(i + 1).toString().padStart(2, "0")}</td>
                  <td className="py-3 pr-4 font-bold tracking-tighter-apple text-base text-ink-900">{gw.gateway_id}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink-500">{gw.mac_address}</td>
                  <td className="py-3 pr-4 font-medium tracking-tighter-apple">{gw.room_number ? `Room ${gw.room_number}` : "—"}</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-ink-500 tabular">{gw.rssi} dBm</td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-ink-500 tabular">{gw.assigned_tags_count}</td>
                  <td className="py-3"><StatusBadge status={gw.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>

      {selected && <GatewayDetailDialog gw={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
