import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useCurrency } from "../lib/currency";
import { SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

const COLORS = ["#1A1A1A", "#FF7E6B", "#3E2723", "#B8860B", "#2E5C3D", "#8B0000"];

export default function Reports() {
  const [revenue, setRevenue] = useState(null);
  const [items, setItems] = useState([]);
  const [byRoom, setByRoom] = useState([]);
  const { format } = useCurrency();

  useEffect(() => {
    Promise.all([
      api.get("/reports/revenue?days=14"),
      api.get("/reports/item-consumption"),
      api.get("/reports/room-consumption"),
    ]).then(([r, i, b]) => {
      setRevenue(r.data);
      setItems(i.data);
      setByRoom(b.data);
    });
  }, []);

  if (!revenue) return <div className="space-y-3"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-16">
      <SectionHeader
        overline="Reports · the last fourteen days"
        title={<>The figures,<br /><span className="italic text-brand">unadorned.</span></>}
        lead="Charts stripped to their lines. The data does the talking — no decoration, no grid, no chartjunk."
      />

      {/* Hero revenue line - massive */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <p className="smallcaps">Revenue · trailing 14 days</p>
          <p className="font-display italic text-4xl tabular text-brand">{format(revenue.total)}</p>
        </div>
        <div className="hairline mb-8" />
        {revenue.series.length === 0 ? (
          <p className="font-display-text italic text-ink-600 py-16 text-center">No confirmed bills yet. Try the simulator on the dashboard.</p>
        ) : (
          <div className="h-80" style={{ minHeight: 320, minWidth: 1 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={revenue.series} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} stroke="#8A857D" fontSize={10} tickFormatter={(d) => new Date(d).toLocaleDateString("en", { day: "numeric", month: "short" })} />
                <YAxis axisLine={false} tickLine={false} stroke="#8A857D" fontSize={10} />
                <Tooltip
                  cursor={{ stroke: "#D1C9BB", strokeDasharray: 2 }}
                  contentStyle={{ backgroundColor: "#F7F5F0", border: "1px solid #D1C9BB", borderRadius: 0, fontFamily: "Geist", fontSize: 12 }}
                  formatter={(v) => [format(v), "Revenue"]}
                  labelFormatter={(d) => new Date(d).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}
                />
                <Line type="monotone" dataKey="amount" stroke="#1A1A1A" strokeWidth={1.5} dot={{ fill: "#FF7E6B", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#FF7E6B" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Two minimalist charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12">
        {/* Top items - editorial bar list */}
        <section>
          <p className="smallcaps mb-4">Top items by revenue</p>
          <div className="hairline mb-6" />
          {items.length === 0 ? (
            <p className="font-display-text italic text-ink-600 py-8">No data yet.</p>
          ) : (
            <ul className="space-y-5">
              {items.slice(0, 6).map((it, i) => {
                const max = Math.max(...items.map((x) => x.revenue));
                const pct = (it.revenue / max) * 100;
                return (
                  <li key={it.product_id || it.name} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display italic text-lg">{it.name}</span>
                      <span className="font-display text-xl tabular">{format(it.revenue)}</span>
                    </div>
                    <div className="relative h-px bg-hairline-soft">
                      <div
                        className="absolute left-0 top-0 h-px bg-ink-900 transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <p className="smallcaps text-ink-400 font-mono">{it.count} units sold</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* By room - editorial bars */}
        <section>
          <p className="smallcaps mb-4">Revenue by room</p>
          <div className="hairline mb-6" />
          {byRoom.length === 0 ? (
            <p className="font-display-text italic text-ink-600 py-8">No data yet.</p>
          ) : (
            <ul className="space-y-5">
              {byRoom.slice(0, 6).map((r, i) => {
                const max = Math.max(...byRoom.map((x) => x.revenue));
                const pct = (r.revenue / max) * 100;
                return (
                  <li key={r.room || `row-${i}`} className="grid grid-cols-12 gap-4 items-baseline">
                    <span className="col-span-2 ticking-num text-3xl">{r.room}</span>
                    <div className="col-span-10">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="font-display-text italic text-ink-600">{r.count} bills</span>
                        <span className="font-display text-xl tabular">{format(r.revenue)}</span>
                      </div>
                      <div className="relative h-px bg-hairline-soft">
                        <div
                          className="absolute left-0 top-0 h-px bg-brand transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
