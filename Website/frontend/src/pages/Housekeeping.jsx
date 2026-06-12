import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Housekeeping() {
  const [rooms, setRooms] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.get("/rooms"), api.get("/tags")]);
      setRooms(r.data);
      setTags(t.data);
    } catch (err) { console.warn("Housekeeping fetch failed:", err); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const restock = async (tag) => {
    try {
      await api.post(`/tags/${tag.id}/request-restock`);
      toast.success("Restock requested", { description: `Notification sent for Room ${tag.room_number}` });
      fetchAll();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  const updateRoomStatus = async (room, status) => {
    try {
      await api.patch(`/rooms/${room.id}`, { status });
      toast.success(`Room ${room.room_number} · ${status.replace("_", " ")}`);
      fetchAll();
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const needsRestock = tags.filter(t => ["tamper_triggered", "low_battery", "not_seen"].includes(t.status));
  const tagsByRoom = {};
  tags.forEach(t => {
    if (t.assigned_room_id) {
      if (!tagsByRoom[t.assigned_room_id]) tagsByRoom[t.assigned_room_id] = [];
      tagsByRoom[t.assigned_room_id].push(t);
    }
  });

  return (
    <div className="space-y-12">
      <SectionHeader
        overline={`${needsRestock.length} items waiting on a touch · ${rooms.length} rooms in the house`}
        title={<>Housekeeping,<br /><span className="italic text-brand">in motion.</span></>}
        lead="The chambermaid's list, ordered. Restock the opened, replace the worn, attend the do-not-disturb."
        right={
          <button onClick={fetchAll} className="smallcaps ink-link text-ink-600" data-testid="refresh-housekeeping">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        }
      />

      {/* Needs attention - editorial alert section */}
      {needsRestock.length > 0 && (
        <section data-testid="needs-restock-card">
          <div className="flex items-baseline justify-between mb-4">
            <p className="smallcaps text-oxblood">Needs attention · {needsRestock.length}</p>
            <p className="font-display-text italic text-ink-600 text-sm">Mark restocked after each visit</p>
          </div>
          <div className="hairline mb-6" />
          <ul className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-6">
            {needsRestock.slice(0, 12).map((t, i) => (
              <li key={t.id} className="grid grid-cols-12 gap-3 items-baseline py-3 border-b border-hairline-soft">
                <span className="col-span-1 smallcaps text-ink-400 font-mono">{(i + 1).toString().padStart(2, "0")}</span>
                <div className="col-span-7">
                  <p className="font-display text-xl">Room {t.room_number}</p>
                  <p className="smallcaps text-ink-400 mt-0.5">{t.product_name || t.tag_id}</p>
                </div>
                <div className="col-span-4 flex flex-col items-end gap-2">
                  <StatusBadge status={t.status} />
                  <button onClick={() => restock(t)} className="smallcaps ink-link text-brand" data-testid={`hk-restock-${t.tag_id}`}>
                    <ClipboardCheck className="w-3 h-3" /> Request
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* All rooms — editorial list */}
      <section>
        <p className="smallcaps mb-4">All rooms · minibar status</p>
        <div className="hairline mb-2" />
        <ul className="divide-y divide-hairline">
          {rooms.map((room, i) => {
            const rTags = tagsByRoom[room.id] || [];
            const issues = rTags.filter(t => t.status !== "active").length;
            return (
              <li key={room.id} className="py-8 grid grid-cols-12 gap-6 items-start" data-testid={`hk-room-${room.room_number}`}>
                <div className="col-span-2 lg:col-span-2">
                  <p className="ticking-num text-5xl">{room.room_number}</p>
                  <p className="smallcaps text-ink-400 mt-1">Floor {room.floor}</p>
                </div>
                <div className="col-span-7 lg:col-span-7">
                  <div className="flex items-baseline gap-4 mb-2">
                    <p className="font-display text-xl italic">{room.room_type}</p>
                    <StatusBadge status={room.status} />
                  </div>
                  {rTags.length === 0 ? (
                    <p className="font-display-text italic text-ink-600 text-sm">No tags assigned</p>
                  ) : (
                    <ul className="space-y-1.5 mt-2">
                      {rTags.map(t => (
                        <li key={t.id} className="flex items-baseline justify-between text-sm">
                          <span className="text-ink-900">{t.product_name || t.tag_id}</span>
                          <StatusBadge status={t.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="col-span-3 lg:col-span-3 flex flex-col items-end gap-2">
                  <button onClick={() => updateRoomStatus(room, "cleaning")} className="smallcaps ink-link text-ink-600">Mark cleaning</button>
                  <button onClick={() => updateRoomStatus(room, "vacant")} className="smallcaps ink-link text-ink-600">Mark vacant</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
