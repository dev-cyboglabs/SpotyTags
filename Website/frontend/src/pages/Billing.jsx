import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useEventListener } from "../lib/realtime";
import { useCurrency } from "../lib/currency";
import { StatusBadge } from "../components/StatusBadge";
import { SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Check, X, AlertCircle, Plus, Gift, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth, canAccess } from "../lib/auth";
import { cn } from "../lib/utils";

function ManualBillDialog({ onDone }) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [products, setProducts] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const { format, symbol } = useCurrency();

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get("/rooms"), api.get("/products?active=true")]).then(([r, p]) => {
      setRooms(r.data);
      setProducts(p.data);
    });
  }, [open]);

  const submit = async () => {
    try {
      await api.post("/billing/manual", {
        room_id: roomId, product_id: productId,
        selling_price: price ? parseFloat(price) : undefined,
      });
      toast.success("Manual bill added", { description: `Room ${roomId} · ${productId ? 'Product added' : 'Custom amount'}` });
      setOpen(false);
      onDone?.();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button className="smallcaps ink-link text-ink-900 flex items-center gap-2" data-testid="manual-bill-button"><Plus className="w-3 h-3" /> Add manual item</button></DialogTrigger>
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl">
        <DialogHeader><DialogTitle asChild><h3 className="font-display text-3xl">Add a manual bill item</h3></DialogTitle></DialogHeader>
        <div className="hairline my-4" />
        <div className="space-y-6">
          <div>
            <label className="smallcaps">Room</label>
            <Select value={roomId} onValueChange={setRoomId}><SelectTrigger className="border-0 border-b border-ink-200 rounded-none px-0 mt-2 text-lg"><SelectValue placeholder="Select room" /></SelectTrigger>
              <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>Room {r.room_number}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="smallcaps">Product</label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); const p = products.find(x => x.id === v); if (p) setPrice(p.selling_price); }}>
              <SelectTrigger className="border-0 border-b border-ink-200 rounded-none px-0 mt-2 text-lg"><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {format(p.selling_price)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="smallcaps">Price ({symbol})</label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-2xl font-display tabular" /></div>
          <button onClick={submit} className="w-full py-3.5 btn-apple btn-apple-primary">Add</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BillLedger({ events, onAction, allowActions = true }) {
  const { format } = useCurrency();
  if (events.length === 0)
    return <p className="font-display-text italic text-ink-600 py-12">A quiet ledger. Nothing here yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-hairline">
          <th className="text-left smallcaps text-ink-400 pb-3 pr-4">№</th>
          <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Time</th>
          <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Room</th>
          <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Guest</th>
          <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Item</th>
          <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Tag</th>
          <th className="text-right smallcaps text-ink-400 pb-3 pr-4">Amount</th>
          <th className="text-left smallcaps text-ink-400 pb-3 pr-4">Status</th>
          {allowActions && <th className="text-right smallcaps text-ink-400 pb-3">Action</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline-soft">
        {events.map((e, i) => (
          <tr key={e.id} className="group hover:bg-white transition-colors" data-testid={`bill-row-${e.id}`}>
            <td className="py-4 pr-4 smallcaps text-ink-400 font-mono">{(i + 1).toString().padStart(3, "0")}</td>
            <td className="py-4 pr-4 font-mono text-xs text-ink-600 tabular">{new Date(e.detected_at).toLocaleString()}</td>
            <td className="py-4 pr-4"><span className="font-display text-xl">{e.room_number}</span></td>
            <td className="py-4 pr-4 font-display-text italic text-ink-600">{e.guest_name || "—"}</td>
            <td className="py-4 pr-4"><span className="font-display italic">{e.product_name || "—"}</span></td>
            <td className="py-4 pr-4 font-mono text-xs text-ink-600">{e.tag_id}</td>
            <td className="py-4 pr-4 text-right"><span className="font-display text-xl tabular">{format(e.selling_price)}</span></td>
            <td className="py-4 pr-4"><StatusBadge status={e.status} /></td>
            {allowActions && (
              <td className="py-4 text-right space-x-4 whitespace-nowrap">
                {e.status === "pending_review" && (
                  <>
                    <button onClick={() => onAction(e, "confirm")} className="smallcaps ink-link text-status-success" data-testid={`confirm-${e.id}`}>
                      <Check className="w-3 h-3" /> Confirm
                    </button>
                    <button onClick={() => onAction(e, "waive")} className="smallcaps ink-link text-status-warning" data-testid={`waive-${e.id}`}>
                      <X className="w-3 h-3" /> Waive
                    </button>
                    <button onClick={() => onAction(e, "dispute")} className="smallcaps ink-link text-oxblood" data-testid={`dispute-${e.id}`}>
                      <AlertCircle className="w-3 h-3" /> Dispute
                    </button>
                    <button onClick={() => onAction(e, "complimentary")} className="smallcaps ink-link text-brand" data-testid={`complimentary-${e.id}`}>
                      <Gift className="w-3.5 h-3.5" /> Complimentary
                    </button>
                  </>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Billing() {
  const [pending, setPending] = useState([]);
  const [confirmed, setConfirmed] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const { role } = useAuth();
  const { format } = useCurrency();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, c, a] = await Promise.all([
        api.get("/billing/pending"),
        api.get("/billing/confirmed"),
        api.get("/billing/events"),
      ]);
      setPending(p.data);
      setConfirmed(c.data);
      setAllEvents(a.data);
    } catch (err) { console.warn("Billing fetch failed:", err); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);
  useEventListener("billing_created", fetchAll);
  useEventListener("billing_updated", fetchAll);
  useEventListener("tamper", fetchAll);

  const handleAction = async (event, action) => {
    try {
      await api.post(`/billing/${event.id}/action`, { action });
      toast.success(`Bill ${action}`, { description: `Room ${event.room_number} · ${format(event.total)}` });
      fetchAll();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  const todayRevenue = confirmed.filter(e => {
    const d = new Date(e.detected_at);
    return d.toDateString() === new Date().toDateString();
  }).reduce((sum, e) => sum + e.selling_price, 0);

  const filteredLedgerEvents = allEvents.filter(e => {
    if (ledgerFilter === "all") return true;
    return e.status === ledgerFilter;
  });

  const filterBySearch = (list) => {
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter((e) => {
      const roomNum = String(e.room_number || "").toLowerCase();
      const guestName = String(e.guest_name || "").toLowerCase();
      const productName = String(e.product_name || "").toLowerCase();
      return roomNum.includes(query) || guestName.includes(query) || productName.includes(query);
    });
  };

  const filteredPending = filterBySearch(pending);
  const filteredConfirmed = filterBySearch(confirmed);
  const filteredAll = filterBySearch(filteredLedgerEvents);

  return (
    <div className="space-y-10">
      <SectionHeader
        overline={`${pending.length} pending · ${format(todayRevenue)} confirmed today`}
        title={<>The billing<br /><span className="italic text-brand">ledger.</span></>}
        lead="Every tamper becomes a line. Confirm to add to the folio; waive when the guest insists; dispute when the seal looks honest."
        right={canAccess(role, ["hotel_admin", "reception"]) && <ManualBillDialog onDone={fetchAll} />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-transparent p-0 h-auto border-b border-hairline w-full flex items-center justify-between gap-10">
          <div className="flex items-center gap-10">
            {[
              { v: "pending", label: "Pending", count: filteredPending.length, testId: "pending-tab" },
              { v: "confirmed", label: "Confirmed", count: filteredConfirmed.length, testId: "confirmed-tab" },
              { v: "all", label: "Ledger", count: filteredAll.length, testId: "all-tab" },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                data-testid={t.testId}
                className={cn(
                  "rounded-none bg-transparent border-0 px-0 py-4 font-display text-2xl",
                  "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  "data-[state=active]:text-brand text-ink-600 hover:text-ink-900 relative",
                  "data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-px data-[state=active]:after:bg-brand"
                )}
              >
                {t.label} <span className="smallcaps text-ink-400 ml-2 font-mono">{t.count}</span>
              </TabsTrigger>
            ))}
          </div>

          <div className="flex items-center gap-4 self-center pb-2">
            {/* Search Box */}
            <div className="relative w-48 lg:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-400" />
              <Input
                type="text"
                placeholder="Search room or guest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white/80 border-hairline focus:ring-0 focus:ring-offset-0 rounded-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-ink-400 hover:text-ink-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter - visible only on Ledger tab */}
            {activeTab === "all" && (
              <div className="flex items-center gap-2">
                <span className="smallcaps text-ink-400 text-xs font-semibold">Filter:</span>
                <Select value={ledgerFilter} onValueChange={setLedgerFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs font-medium border-hairline bg-white/80 focus:ring-0 focus:ring-offset-0">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-cream">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="disputed">Disputed</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                    <SelectItem value="complimentary">Complimentary</SelectItem>
                    <SelectItem value="added_to_bill">Added to bill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </TabsList>
        <TabsContent value="pending"><BillLedger events={filteredPending} onAction={handleAction} /></TabsContent>
        <TabsContent value="confirmed"><BillLedger events={filteredConfirmed} onAction={handleAction} allowActions={false} /></TabsContent>
        <TabsContent value="all" className="space-y-4">
          <BillLedger events={filteredAll} onAction={handleAction} allowActions={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
