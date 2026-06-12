import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { StatusBadge, StatusDot } from "../components/StatusBadge";
import { SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Plus, X, MoreVertical, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth, canAccess } from "../lib/auth";
import { useQuota, useLicense } from "../lib/license";
import { useCurrency } from "../lib/currency";

const STATUSES = [
  "vacant", "occupied", "checkout_pending", "cleaning", "maintenance", "do_not_disturb",
];

function RoomDetailSheet({ room, onClose }) {
  const [detail, setDetail] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const { format } = useCurrency();

  useEffect(() => {
    if (!room) return;
    setDetail(null);
    setInvoice(null);
    api.get(`/rooms/${room.id}`).then((r) => setDetail(r.data));
    api.get(`/billing/room/${room.id}/invoice`).then((r) => setInvoice(r.data)).catch(() => {});
  }, [room]);

  if (!room) return null;
  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-cream border border-hairline rounded-3xl shadow-apple-xl"
        data-testid={`room-detail-${room.room_number}`}
      >
        <div className="p-8 lg:p-12">
          <DialogHeader>
            <DialogTitle asChild>
              <div className="flex items-baseline gap-6">
                <span className="ticking-num text-7xl lg:text-8xl text-ink-900">{room.room_number}</span>
                <div className="space-y-1">
                  <p className="smallcaps">Room · Floor {room.floor}</p>
                  <p className="font-display text-2xl italic">{room.room_type}</p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="hairline mt-8" />

          {!detail ? (
            <Skeleton className="h-40 mt-6" />
          ) : (
            <div className="mt-8 space-y-10">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
                <div>
                  <p className="smallcaps mb-2">Status</p>
                  <StatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="smallcaps mb-2">Gateway</p>
                  {detail.gateway ? <StatusBadge status={detail.gateway.status} /> : <span className="font-display-text italic text-ink-600">None linked</span>}
                </div>
                {detail.guest_name && (
                  <div className="col-span-2">
                    <p className="smallcaps mb-2">Guest</p>
                    <p className="font-display text-xl italic">{detail.guest_name}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="smallcaps mb-4">Minibar</p>
                <div className="hairline mb-3" />
                {detail.tags.length === 0 ? (
                  <p className="font-display-text italic text-ink-600">No tags assigned yet.</p>
                ) : (
                  <ul className="divide-y divide-hairline-soft">
                    {detail.tags.map((t, i) => (
                      <li key={t.id} className="flex items-baseline gap-6 py-4">
                        <span className="smallcaps text-ink-400 font-mono w-8">{(i + 1).toString().padStart(2, "0")}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-lg leading-tight">{t.product?.name || "Unassigned"}</p>
                          <p className="smallcaps text-ink-400 mt-0.5">{t.tag_id} · battery {t.battery}%</p>
                        </div>
                        <StatusBadge status={t.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {invoice && invoice.items.length > 0 && (
                <div>
                  <p className="smallcaps mb-4">Folio</p>
                  <div className="hairline mb-2" />
                  <div className="bg-white border border-hairline p-6">
                    <ul className="divide-y divide-hairline-soft">
                      {invoice.items.map((it) => (
                        <li key={it.id} className="flex items-baseline justify-between py-2">
                          <span className="text-sm">{it.product_name}</span>
                          <span className="font-display text-base italic tabular">{format(it.selling_price)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-hairline mt-4 pt-4 space-y-1.5">
                      <div className="flex justify-between text-sm"><span className="smallcaps">Subtotal</span><span className="tabular">{format(invoice.subtotal)}</span></div>
                      <div className="flex justify-between text-sm"><span className="smallcaps">Tax</span><span className="tabular">{format(invoice.tax)}</span></div>
                      <div className="flex justify-between font-display text-2xl mt-3 pt-3 border-t border-hairline"><span>Total</span><span className="italic">{format(invoice.total)}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateRoomDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ room_number: "", floor: "1", room_type: "Deluxe", status: "vacant", guest_name: "" });
  const [loading, setLoading] = useState(false);
  const quota = useQuota("rooms");
  const { refresh } = useLicense();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/rooms", form);
      toast.success("Room created", { description: `Room ${form.room_number} · ${form.room_type}` });
      setOpen(false);
      setForm({ room_number: "", floor: "1", room_type: "Deluxe", status: "vacant", guest_name: "" });
      onCreated?.();
      refresh();
    } catch (e) {
      toast.error("Failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    } finally {
      setLoading(false);
    }
  };

  const reached = quota.blocked;

  const handleUpgrade = () => {
    navigate("/license");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !reached && setOpen(v)}>
      {reached ? (
        <div className="flex items-center gap-3">
          <span className="smallcaps text-ink-300">limit {quota.current}/{quota.limit}</span>
          <button
            onClick={handleUpgrade}
            className="smallcaps ink-link text-brand flex items-center gap-2 hover:text-brand/80 transition-colors"
            data-testid="upgrade-plan-button"
          >
            Upgrade plan
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <DialogTrigger asChild>
          <button
            className="smallcaps ink-link text-ink-900 flex items-center gap-2"
            data-testid="add-room-button"
          >
            <Plus className="w-3 h-3" />
            Add room
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl">
        <DialogHeader><DialogTitle asChild><h3 className="font-display text-3xl font-medium tracking-display-tight">Add a room</h3></DialogTitle></DialogHeader>
        <div className="hairline my-4" />
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="smallcaps">Room number</label>
              <Input required value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" data-testid="room-number-input" />
            </div>
            <div>
              <label className="smallcaps">Floor</label>
              <Input required value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" />
            </div>
          </div>
          <div>
            <label className="smallcaps">Room type</label>
            <Input value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" />
          </div>
          <div>
            <label className="smallcaps">Status</label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="border-0 border-b border-ink-200 rounded-none px-0 mt-2 text-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="smallcaps">Guest name (optional)</label>
            <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 btn-apple btn-apple-primary" data-testid="submit-room">
            {loading ? "Saving…" : "Create room"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRoomDialog({ room, onUpdated, onClose }) {
  const [form, setForm] = useState({ room_number: "", floor: "", room_type: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (room) {
      setForm({ room_number: room.room_number, floor: room.floor, room_type: room.room_type });
    }
  }, [room]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/rooms/${room.id}`, form);
      toast.success("Room updated", { description: `Room ${form.room_number} · ${form.room_type}` });
      onClose();
      onUpdated?.();
    } catch (e) {
      toast.error("Failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl">
        <DialogHeader><DialogTitle asChild><h3 className="font-display text-3xl font-medium tracking-display-tight">Edit room</h3></DialogTitle></DialogHeader>
        <div className="hairline my-4" />
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="smallcaps">Room number</label>
              <Input required value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" />
            </div>
            <div>
              <label className="smallcaps">Floor</label>
              <Input required value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" />
            </div>
          </div>
          <div>
            <label className="smallcaps">Room type</label>
            <Input required value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })} className="border-0 border-b border-ink-200 focus:border-ink-900 bg-transparent rounded-none px-0 mt-2 text-lg" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 btn-apple btn-apple-primary">
            {loading ? "Saving…" : "Update room"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ room, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/rooms/${room.id}`);
      toast.success("Room deleted", { description: `Room ${room.room_number}` });
      onConfirm();
    } catch (e) {
      toast.error("Failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-cream border border-hairline rounded-3xl p-10 shadow-apple-xl max-w-md">
        <DialogHeader>
          <DialogTitle asChild>
            <h3 className="font-display text-3xl font-medium tracking-display-tight">Delete room</h3>
          </DialogTitle>
        </DialogHeader>
        <div className="hairline my-4" />
        <p className="text-ink-900 mb-6">
          Are you sure you want to delete room <span className="font-bold">{room?.room_number}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3.5 btn-apple border border-ink-200 text-ink-900"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-3.5 btn-apple bg-brand text-white hover:bg-brand/90"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deletingRoom, setDeletingRoom] = useState(null);
  const { role } = useAuth();

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/rooms");
      const sortedRooms = data.sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.room_number - b.room_number;
      });
      setRooms(sortedRooms);
    } catch (err) {
      console.warn("Rooms fetch failed:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const filtered = filter === "all" ? rooms : rooms.filter((r) => r.status === filter);

  const handleEdit = (e, room) => {
    e.stopPropagation();
    setEditingRoom(room);
  };

  const handleDelete = (e, room) => {
    e.stopPropagation();
    setDeletingRoom(room);
  };

  const handleDeleteConfirm = () => {
    setDeletingRoom(null);
    fetchRooms();
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        overline={`${rooms.length} rooms across two floors`}
        title={<>The rooms,<br /><span className="italic text-brand">in order.</span></>}
        lead="Every room has a story. Click to read it — guests, gateways, the bottles they've opened."
        right={
          <div className="flex items-center gap-6">
            <div>
              <label className="smallcaps block mb-1">Filter</label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="border-0 border-b border-ink-200 rounded-none pl-2 text-base font-display italic [&>span]:pr-2" data-testid="room-filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({rooms.length})</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canAccess(role, ["hotel_admin"]) && <CreateRoomDialog onCreated={fetchRooms} />}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="font-display-text italic text-ink-600 py-12">No rooms match this filter.</p>
      ) : (
        /* Editorial list-table — large number left, details right, hairline rows */
        <ul className="divide-y divide-hairline">
          {filtered.map((r, i) => (
            <li
              key={r.id}
              data-testid={`room-card-${r.room_number}`}
            >
              <button
                onClick={() => setSelected(r)}
                className="w-full text-left group grid grid-cols-12 gap-6 py-8 items-center hover:bg-white transition-colors duration-300"
              >
                {/* Room number — display type */}
                <div className="col-span-3 lg:col-span-2">
                  <p className="ticking-num text-5xl lg:text-6xl text-ink-900 group-hover:text-brand transition-colors duration-300">{r.room_number}</p>
                </div>

                {/* Meta */}
                <div className="col-span-5 lg:col-span-5">
                  <p className="font-display text-xl italic">{r.room_type}</p>
                  <p className="smallcaps text-ink-400 mt-1">Floor {r.floor} · {r.guest_name || "Vacant"}</p>
                </div>

                {/* Status */}
                <div className="col-span-3 lg:col-span-3">
                  <StatusBadge status={r.status} />
                  <p className="smallcaps text-ink-400 mt-2 font-mono">
                    {r.gateway_id ? "Gateway linked" : "No gateway"}
                  </p>
                </div>

                <div className="col-span-1 lg:col-span-2 text-right">
                  {canAccess(role, ["hotel_admin"]) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 hover:bg-white rounded-full transition-colors">
                          <MoreVertical className="w-4 h-4 text-ink-600" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => handleEdit(e, r)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleDelete(e, r)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="smallcaps ink-link text-ink-600 group-hover:text-brand">View</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <RoomDetailSheet room={selected} onClose={() => setSelected(null)} />}
      {editingRoom && <EditRoomDialog room={editingRoom} onUpdated={fetchRooms} onClose={() => setEditingRoom(null)} />}
      {deletingRoom && <DeleteConfirmDialog room={deletingRoom} onConfirm={handleDeleteConfirm} onClose={() => setDeletingRoom(null)} />}
    </div>
  );
}
