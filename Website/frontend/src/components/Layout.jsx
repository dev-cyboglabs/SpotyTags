import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth, ROLE_LABELS } from "../lib/auth";
import { useRealtime } from "../lib/realtime";
import { useLicense } from "../lib/license";
import { useBranding } from "../lib/branding";
import { api } from "../lib/api";
import { Logo } from "./Logo";
import { LicenseBanner } from "./LicenseBanner";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import {
  Bell, LogOut, Menu, Wifi, WifiOff, Cloud, CloudOff,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Sheet, SheetContent } from "./ui/sheet";

const SECTIONS = [
  {
    title: "Overview",
    items: [
      { to: "/", label: "Dashboard", roles: ["super_admin", "hotel_admin", "reception", "housekeeping", "technician"] },
      { to: "/front-desk", label: "Front Desk", roles: ["super_admin", "hotel_admin", "reception"] },
      { to: "/billing", label: "Billing", roles: ["super_admin", "hotel_admin", "reception"] },
    ],
  },
  {
    title: "Inventory",
    items: [
      { to: "/rooms", label: "Rooms", roles: ["super_admin", "hotel_admin", "reception", "housekeeping"] },
      { to: "/tags", label: "Tags", roles: ["super_admin", "hotel_admin", "technician", "housekeeping"] },
      { to: "/gateways", label: "Gateways", roles: ["super_admin", "hotel_admin", "technician"] },
      { to: "/products", label: "Catalogue", roles: ["super_admin", "hotel_admin"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/housekeeping", label: "Housekeeping", roles: ["super_admin", "hotel_admin", "housekeeping", "reception"] },
      { to: "/mobile-app-info", label: "Staff Mobile", roles: ["super_admin", "hotel_admin", "housekeeping", "technician"] },
      { to: "/reports", label: "Reports", roles: ["super_admin", "hotel_admin"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/users", label: "Users", roles: ["super_admin", "hotel_admin"] },
      { to: "/license", label: "License", roles: ["super_admin", "hotel_admin"] },
      { to: "/audit", label: "Audit Log", roles: ["super_admin", "hotel_admin"] },
      { to: "/settings", label: "Settings", roles: ["super_admin", "hotel_admin"] },
      { to: "/super-admin", label: "Brand & Local", roles: ["super_admin"] },
    ],
  },
];

function SectionedNav({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const filtered = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => role === "super_admin" || i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="h-full flex flex-col bg-cream/70 backdrop-blur-xl">
      {/* Brand block */}
      <div className="px-8 pt-9 pb-7 border-b border-hairline-soft">
        <span className="font-display font-medium tracking-display-tight inline-flex items-baseline gap-0" data-testid="brand-wordmark" title="SpotyTags">
          <span className="text-ink-900">Spoty</span>
          <span className="text-brand">Tags</span>
        </span>
        <p className="smallcaps mt-3 text-ink-400">Hospitality OS · v1.0</p>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-6 py-7">
        <nav className="space-y-9">
          {filtered.map((section) => (
            <div key={section.title}>
              <p className="smallcaps mb-3 px-2 text-ink-400">{section.title}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onNavigate}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center justify-between px-2.5 py-2 rounded-lg font-medium text-[15px] transition-all duration-300",
                          isActive
                            ? "bg-ink-900 text-cream shadow-apple-sm"
                            : "text-ink-700 hover:bg-white/60 hover:text-ink-900"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="tracking-tighter-apple">{item.label}</span>
                          {isActive && <span className="text-brand text-[8px]">●</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="px-6 pb-7 pt-5 border-t border-hairline-soft">
        <div className="px-2">
          <p className="smallcaps mb-1.5 text-ink-400">Signed in as</p>
          <p className="text-[15px] font-semibold leading-tight tracking-tighter-apple">{user?.name}</p>
          <p className="text-xs text-ink-500 mt-0.5">{ROLE_LABELS[user?.role]}</p>
          <button
            onClick={async () => { await logout(); navigate("/login"); }}
            data-testid="menu-logout"
            className="mt-3 ink-link smallcaps text-ink-500 hover:text-oxblood"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationsBell() {
  const { notifications, unreadCount, markAllRead, refresh } = useRealtime();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  const clearAll = async () => {
    try {
      await api.delete("/notifications");
      refresh();
      toast.success("All notifications cleared");
    } catch (e) {
      toast.error("Failed", { description: e.response?.data?.detail || e.message });
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center gap-2 px-3 py-2 rounded-full text-ink-900 hover:bg-white/60 transition-colors"
          data-testid="notifications-button"
        >
          <Bell className="w-4 h-4 stroke-[1.6]" />
          <span className="smallcaps text-ink-600 hidden sm:inline">Activity</span>
          {unreadCount > 0 && (
            <span
              className="absolute -top-0 -right-1 min-w-[16px] h-[16px] px-1 bg-brand text-white text-[9px] font-bold flex items-center justify-center font-mono rounded-full shadow-apple-sm"
              data-testid="notifications-badge"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px] surface-apple p-0 border-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline-soft">
          <DropdownMenuLabel className="p-0 text-base font-semibold tracking-tighter-apple">Recent Activity</DropdownMenuLabel>
          {notifications.length > 0 && (
            <button onClick={clearAll} className="smallcaps ink-link text-oxblood hover:text-oxblood/80" data-testid="clear-all">
              Clear all
            </button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-ink-500 font-display-text">Quiet halls tonight.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={cn("px-5 py-3 border-b border-hairline-soft last:border-0", !n.read && "bg-brand/[0.04]")} data-testid={`notification-${n.id}`}>
                <div className="flex items-start gap-3">
                  <span
                    className="mt-2 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor:
                      n.severity === "danger" ? "#8B2424" :
                      n.severity === "warning" ? "#B8860B" :
                      n.severity === "success" ? "#1F7A3D" : "#52504A" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 tracking-tighter-apple">{n.title}</p>
                    <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="smallcaps text-ink-400 mt-1 font-mono text-[10px]">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CloudStatusPill() {
  const [cloud, setCloud] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const { api } = await import("../lib/api");
        const { data } = await api.get("/cloud/status");
        if (!cancelled) setCloud(data);
      } catch (err) {
        if (!cancelled) console.warn("Cloud status fetch failed:", err?.message || err);
      }
    };
    fetchStatus();
    const onSync = () => fetchStatus();
    window.addEventListener("spotytags:cloud_sync", onSync);
    const t = setInterval(fetchStatus, 15000);
    return () => {
      cancelled = true;
      window.removeEventListener("spotytags:cloud_sync", onSync);
      clearInterval(t);
    };
  }, []);
  if (!cloud) return null;
  const offline = !cloud.online;
  const pending = cloud.pending_count || 0;
  const failed = cloud.failed_count || 0;
  const label = offline
    ? "Offline · queued"
    : pending > 0
    ? `${pending} queued`
    : "Synced";
  return (
    <span
      data-testid="cloud-status-badge"
      title={cloud.last_error || "Cloud sync"}
      className={cn(
        "smallcaps flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono",
        offline
          ? "bg-status-danger/10 text-status-danger"
          : failed > 0
          ? "bg-status-warning/10 text-status-warning"
          : pending > 0
          ? "bg-status-warning/10 text-status-warning"
          : "bg-status-success/10 text-status-success"
      )}
    >
      {offline ? <CloudOff className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
      {label}
    </span>
  );
}

function TopBar({ onOpenMobile }) {
  const location = useLocation();
  const { connected } = useRealtime();
  const { hotel_name } = useBranding();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const path = location.pathname;
  const sectionTitle =
    path === "/" ? "Today" :
    path.startsWith("/rooms") ? "Rooms" :
    path.startsWith("/billing") ? "Billing" :
    path.startsWith("/front-desk") ? "Front Desk" :
    path.startsWith("/tags") ? "Tags" :
    path.startsWith("/gateways") ? "Gateways" :
    path.startsWith("/products") ? "Catalogue" :
    path.startsWith("/housekeeping") ? "Housekeeping" :
    path.startsWith("/mobile-app-info") ? "Staff Mobile" :
    path.startsWith("/mobile-app-download") ? "Download App" :
    path.startsWith("/reports") ? "Reports" :
    path.startsWith("/users") ? "Users" :
    path.startsWith("/license") ? "License" :
    path.startsWith("/audit") ? "Audit" :
    path.startsWith("/settings") ? "Settings" : "";

  return (
    <header className="sticky top-0 z-30 glass-apple">
      <div className="flex items-center px-6 lg:px-12 h-16 gap-6">
        <button
          className="lg:hidden flex items-center gap-2 smallcaps text-ink-700 hover:text-ink-900 transition-colors"
          onClick={onOpenMobile}
          data-testid="mobile-menu-toggle"
        >
          <Menu className="w-4 h-4" /> Menu
        </button>

        <div className="hidden lg:flex items-baseline gap-2">
          <span className="smallcaps text-xs text-ink-400">{hotel_name}</span>
          <span className="text-ink-300 text-xs">/</span>
          <span className="text-sm font-semibold tracking-tighter-apple text-ink-900">{sectionTitle}</span>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-3">
          <CloudStatusPill />
          <span className="smallcaps text-ink-400 font-mono tabular">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <NotificationsBell />
      </div>
    </header>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Desktop sidebar — Apple-style frosted */}
      <aside className="hidden lg:flex w-72 shrink-0 sticky top-0 h-screen border-r border-hairline-soft">
        <SectionedNav />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-80 border-r border-hairline bg-cream rounded-none">
          <SectionedNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <LicenseBanner />
        <TopBar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 px-5 lg:px-10 xl:px-14 py-5 lg:py-7">
          <div className="max-w-[1500px] mx-auto reveal">
            <Outlet />
          </div>
        </main>
        <footer className="px-5 lg:px-10 xl:px-14 py-5 border-t border-hairline-soft">
          <div className="max-w-[1500px] mx-auto flex items-center justify-between text-xs">
            <p className="text-ink-500">SpotyTags — Built for hospitality</p>
            <p className="smallcaps text-ink-400 font-mono">© 2026</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Layout;
