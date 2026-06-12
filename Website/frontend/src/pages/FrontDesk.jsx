import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useEventListener } from "../lib/realtime";
import { useCurrency } from "../lib/currency";
import { StatusBadge } from "../components/StatusBadge";
import { Surface, EditorialMetric } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  ArrowRight, LogIn, LogOut, BedDouble, RefreshCw, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

const STATUS_COLUMNS = [
  { key: "occupied", label: "Occupied" },
  { key: "checkout_pending", label: "Checkout" },
  { key: "cleaning", label: "Cleaning" },
  { key: "vacant", label: "Vacant" },
];

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "occupied", label: "Occupied" },
  { key: "checkout_pending", label: "Checkout" },
  { key: "cleaning", label: "Cleaning" },
  { key: "vacant", label: "Vacant" },
];

function CheckInDialog({ room, open, onClose, onDone }) {
  const [guest, setGuest] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setGuest(""); setNotes(""); }, [room?.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!guest.trim()) return;
    setLoading(true);
    try {
      await api.post(`/rooms/${room.id}/check-in`, { guest_name: guest, notes });
      toast.success(`Checked in to Room ${room.room_number}`, { description: `Guest: ${guest}` });
      onDone?.();
      onClose();
    } catch (e) {
      toast.error("Check-in failed", { description: e.response?.data?.detail?.message || e.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-8 lg:p-10 shadow-apple-xl">
        <DialogHeader>
          <DialogTitle asChild>
            <div>
              <p className="smallcaps">Check-in · Room {room?.room_number}</p>
              <h3 className="text-2xl font-bold tracking-display-tight mt-1">A new guest, <span className="accent-serif text-brand">a fresh folio.</span></h3>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="hairline my-3" />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="smallcaps">Guest name</Label>
            <Input
              required autoFocus
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              placeholder="Mr. Mehta"
              className="mt-2 bg-white border border-hairline focus:border-ink-900 rounded-xl px-4 py-3 text-base shadow-apple-sm"
              data-testid="check-in-guest-input"
            />
          </div>
          <div>
            <Label className="smallcaps">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergy, preferences, late check-in…"
              className="mt-2 bg-white border border-hairline focus:border-ink-900 rounded-xl px-4 py-3 text-base shadow-apple-sm"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full btn-apple btn-apple-primary py-3.5" data-testid="confirm-check-in">
            {loading ? "Checking in…" : <>Check in <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckOutDialog({ room, open, onClose, onDone }) {
  const [folio, setFolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { format } = useCurrency();

  const groupedItems = useMemo(() => {
    if (!folio || !folio.items) return [];
    const groups = folio.items.reduce((acc, it) => {
      const key = it.product_name || "Custom Item";
      if (!acc[key]) {
        acc[key] = {
          product_name: key,
          count: 0,
          total_price: 0,
        };
      }
      acc[key].count += 1;
      acc[key].total_price += it.selling_price || 0;
      return acc;
    }, {});
    return Object.values(groups);
  }, [folio]);

  useEffect(() => {
    if (!open || !room) return;
    setDone(false);
    api.get(`/billing/room/${room.id}/invoice`).then((r) => setFolio(r.data)).catch(() => {});
  }, [open, room]);

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/rooms/${room.id}/check-out`);
      toast.success(`Checked out · ${format(data.total)}`, { description: `Room ${room.room_number} · ${data.items?.length || 0} items` });
      setFolio((f) => ({ ...f, ...data }));
      setDone(true);
      onDone?.();
    } catch (e) {
      toast.error("Check-out failed", { description: e.response?.data?.detail?.message || e.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  if (!room) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-8 lg:p-10 shadow-apple-xl max-w-2xl">
        <DialogHeader>
          <DialogTitle asChild>
            <div>
              <p className="smallcaps">Check-out · Room {room?.room_number}</p>
              <h3 className="text-2xl font-bold tracking-display-tight mt-1">The final folio, <span className="accent-serif text-brand">presented.</span></h3>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="hairline my-3" />

        {!folio ? <Skeleton className="h-40" /> : (
          <>
            <p className="smallcaps mb-1">Guest</p>
            <p className="text-lg font-bold tracking-tighter-apple mb-3">{room.guest_name || "—"}</p>

            <p className="smallcaps mb-1">Folio items ({folio.items.length})</p>
            <div className="hairline-soft mb-1" />
            {folio.items.length === 0 ? (
              <p className="text-ink-500 py-4 text-sm">No charges on this folio.</p>
            ) : (
              <ul className="divide-y divide-hairline-soft mb-3 max-h-48 overflow-y-auto">
                {groupedItems.map((git, idx) => (
                  <li key={idx} className="flex justify-between py-2 text-sm">
                    <span>
                      {git.product_name} <span className="text-ink-400 font-mono">({git.count})</span>
                    </span>
                    <span className="font-mono tabular">{format(git.total_price)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-hairline pt-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="smallcaps">Subtotal</span><span className="tabular">{format(folio.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="smallcaps">Tax</span><span className="tabular">{format(folio.tax)}</span></div>
              <div className="flex justify-between font-bold text-2xl pt-2 border-t border-hairline mt-2 tracking-tighter-apple">
                <span>Total</span>
                <span className="tabular text-brand">{format(folio.total)}</span>
              </div>
            </div>

            {!done ? (
              <button onClick={submit} disabled={loading} className="w-full btn-apple btn-apple-primary py-3.5 mt-4" data-testid="confirm-check-out">
                {loading ? "Finalising…" : <>Confirm check-out <LogOut className="w-3.5 h-3.5" /></>}
              </button>
            ) : (
              <div className="mt-4 bg-status-success/8 border border-status-success/20 rounded-xl px-4 py-3 text-center">
                <p className="smallcaps text-status-success">Guest checked out · Room set to cleaning</p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoomTile({ room, folioCount, folioTotal, onCheckIn, onCheckOut, onCleaningDone }) {
  const { format } = useCurrency();
  return (
    <Surface padding="p-4" className="flex flex-col justify-between min-h-[170px]" hover>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="ticking-num text-3xl text-ink-900">{room.room_number}</p>
            <p className="smallcaps text-ink-400 mt-0.5">Floor {room.floor} · {room.room_type}</p>
          </div>
          <StatusBadge status={room.status} />
        </div>
        {room.guest_name && (
          <p className="font-medium tracking-tighter-apple text-sm mt-2 truncate">{room.guest_name}</p>
        )}
        {folioCount > 0 && (
          <p className="text-xs text-ink-500 mt-1.5 tabular">
            {folioCount} item{folioCount === 1 ? "" : "s"} · {format(folioTotal)} on folio
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {room.status === "vacant" && (
          <button onClick={onCheckIn} className="btn-apple btn-apple-primary text-xs px-3 py-2" data-testid={`check-in-${room.room_number}`}>
            <LogIn className="w-3 h-3" /> Check in
          </button>
        )}
        {room.status === "occupied" && (
          <button onClick={onCheckOut} className="btn-apple btn-apple-primary text-xs px-3 py-2" data-testid={`check-out-${room.room_number}`}>
            <LogOut className="w-3 h-3" /> Check out
          </button>
        )}
        {room.status === "cleaning" && (
          <button onClick={onCleaningDone} className="btn-apple btn-apple-primary text-xs px-3 py-2" data-testid={`clean-${room.room_number}`}>
            <BedDouble className="w-3 h-3" /> Mark cleaned
          </button>
        )}
        {room.status === "checkout_pending" && (
          <button onClick={onCleaningDone} className="btn-apple btn-apple-secondary text-xs px-3 py-2" data-testid={`clean-${room.room_number}`}>
            <BedDouble className="w-3 h-3" /> Move to vacant
          </button>
        )}
      </div>
    </Surface>
  );
}

export default function FrontDesk() {
  const [data, setData] = useState(null);
  const [checkInRoom, setCheckInRoom] = useState(null);
  const [checkOutRoom, setCheckOutRoom] = useState(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const { format } = useCurrency();

  const fetchAll = useCallback(async () => {
    try {
      const { data } = await api.get("/operations/front-desk");
      setData(data);
    } catch (err) {
      console.warn("Failed to load front-desk data:", err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 20000);
    return () => clearInterval(t);
  }, [fetchAll]);

  useEventListener("room_updated", fetchAll);
  useEventListener("billing_updated", fetchAll);
  useEventListener("billing_created", fetchAll);
  useEventListener("tamper", fetchAll);

  const cleaningDone = async (room) => {
    try {
      await api.post(`/rooms/${room.id}/cleaning-done`);
      toast.success(`Room ${room.room_number} ready`);
      fetchAll();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail?.message || e.response?.data?.detail || e.message });
    }
  };

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.rooms.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (!q) return true;
      const hay = [r.room_number, r.guest_name, r.floor, r.room_type, r.status]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, tab]);

  // Compute room counts on the frontend so KPI strip + tab badges always match
  const counts = useMemo(() => {
    if (!data) return {};
    return data.rooms.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
  }, [data]);

  if (!data) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}</div>;

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* Compact header — tight top spacing */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="smallcaps">
              {counts.occupied || 0} occupied · {data.pending_bills} bills awaiting · {format(data.today_revenue)} today
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-display-tight leading-tight mt-0.5">
              Front desk, <span className="accent-serif text-brand">at attention.</span>
            </h1>
          </div>
          <button onClick={fetchAll} className="btn-apple btn-apple-secondary text-xs shrink-0" data-testid="refresh-front-desk">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="hairline" />
      </header>

      {/* KPI strip — compact, source-of-truth = data.rooms */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="front-desk-kpi-strip">
        <Surface padding="p-4"><EditorialMetric size="sm" label="Occupied" value={counts.occupied || 0} sublabel="guests on property" /></Surface>
        <Surface padding="p-4"><EditorialMetric size="sm" label="Vacant" value={counts.vacant || 0} sublabel="ready for check-in" /></Surface>
        <Surface padding="p-4"><EditorialMetric size="sm" label="Cleaning" value={counts.cleaning || 0} sublabel="housekeeping" /></Surface>
        <Surface padding="p-4"><EditorialMetric size="sm" label="Checkout" value={counts.checkout_pending || 0} sublabel="awaiting clean" /></Surface>
        <Surface padding="p-4"><EditorialMetric size="sm" label="Pending bills" value={data.pending_bills} sublabel="review at reception" accent={data.pending_bills > 0 ? { text: "review", color: "#FF7E6B" } : null} accentLink={data.pending_bills > 0 ? "/billing" : null} /></Surface>
      </section>

      {/* Search + status filter tabs */}
      <section
        className="flex flex-wrap items-center justify-between gap-3 sticky top-[3.6rem] z-20 -mx-1 px-1 py-2 bg-cream/85 backdrop-blur-md rounded-2xl"
        data-testid="front-desk-toolbar"
      >
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search room, guest, floor…"
            data-testid="front-desk-search-input"
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-hairline focus:border-ink-900 focus:shadow-ring-soft rounded-xl text-sm outline-none transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"
              data-testid="front-desk-search-clear"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-white/60 rounded-xl p-1 border border-hairline">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`front-desk-tab-${t.key}`}
              className={cn(
                "px-3 py-1.5 rounded-lg smallcaps transition-colors text-xs font-medium",
                tab === t.key ? "bg-ink-900 !text-white shadow-apple-sm" : "text-ink-600 hover:text-ink-900"
              )}
            >
              {t.label}
              {t.key !== "all" && (
                <span className={cn("ml-1.5 font-mono text-[10px]", tab === t.key ? "text-white opacity-100" : "opacity-60")}>
                  {counts[t.key] || 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Result count */}
      {query && (
        <p className="text-xs text-ink-500" data-testid="front-desk-result-count">
          {filteredRooms.length} room{filteredRooms.length === 1 ? "" : "s"} matching “{query}”
        </p>
      )}

      {/* Kanban-style room board grouped by status — only show columns relevant to current filter */}
      <section>
        {tab === "all" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STATUS_COLUMNS.map((col) => {
              const rooms = filteredRooms.filter((r) => r.status === col.key);
              return (
                <div key={col.key} className="space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <p className="smallcaps text-ink-600">{col.label}</p>
                    <span className="smallcaps font-mono text-ink-400 tabular">{rooms.length}</span>
                  </div>
                  <div className="hairline-soft" />
                  <div className="space-y-2.5">
                    {rooms.length === 0 && <p className="text-xs text-ink-400 py-2">—</p>}
                    {rooms.map((r) => {
                      const folio = data.folio_by_room[r.id];
                      return (
                        <RoomTile
                          key={r.id}
                          room={r}
                          folioCount={folio?.count || 0}
                          folioTotal={folio?.total || 0}
                          onCheckIn={() => setCheckInRoom(r)}
                          onCheckOut={() => setCheckOutRoom(r)}
                          onCleaningDone={() => cleaningDone(r)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="front-desk-filtered-grid">
            {filteredRooms.length === 0 ? (
              <div className="col-span-full py-10 text-center">
                <p className="text-ink-500 text-sm">No rooms match this filter.</p>
              </div>
            ) : (
              filteredRooms.map((r) => {
                const folio = data.folio_by_room[r.id];
                return (
                  <RoomTile
                    key={r.id}
                    room={r}
                    folioCount={folio?.count || 0}
                    folioTotal={folio?.total || 0}
                    onCheckIn={() => setCheckInRoom(r)}
                    onCheckOut={() => setCheckOutRoom(r)}
                    onCleaningDone={() => cleaningDone(r)}
                  />
                );
              })
            )}
          </div>
        )}
      </section>

      <CheckInDialog room={checkInRoom} open={!!checkInRoom} onClose={() => setCheckInRoom(null)} onDone={fetchAll} />
      <CheckOutDialog room={checkOutRoom} open={!!checkOutRoom} onClose={() => setCheckOutRoom(null)} onDone={fetchAll} />
    </div>
  );
}
