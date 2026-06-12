import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../lib/auth";
import { useBranding } from "../lib/branding";
import { Logo } from "../components/Logo";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { api } from "../lib/api";

const DEMO_USERS = [
  { email: "admin@spotytags.com", password: "Admin@123", role: "Super Admin" },
  { email: "hotel.admin@spotytags.com", password: "Hotel@123", role: "Hotel Admin" },
  { email: "reception@spotytags.com", password: "Recep@123", role: "Reception" },
  { email: "housekeeping@spotytags.com", password: "House@123", role: "Housekeeping" },
  { email: "tech@spotytags.com", password: "Tech@123", role: "Technician" },
];

export default function Login() {
  const { login, isAuthed } = useAuth();
  const brand = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  // Demo-defaults helper — pre-fills credentials only when an env flag is
  // explicitly enabled. In production deployments the form starts blank so
  // no credentials live in the bundle.
  const showDemoDefaults = import.meta.env.VITE_SHOW_DEMO_LOGIN === "true";
  const [email, setEmail] = useState(showDemoDefaults ? "admin@spotytags.com" : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const hotelName = brand.hotel_name || "SpotyTags";

  if (isAuthed) {
    const to = location.state?.from?.pathname || (Capacitor.isNativePlatform() ? "/mobile" : "/");
    return <Navigate to={to} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      // Check license status after login
      try {
        const licenseResponse = await api.get("/license/validate");
        if (licenseResponse.data.blocked) {
          // Store error for modal to pick up
          window.__licenseError = {
            code: `license_${licenseResponse.data.block_reason}`,
            license_status: licenseResponse.data.block_reason || "expired",
          };
          // Dispatch event for modal
          window.dispatchEvent(new CustomEvent('license-expired', { detail: window.__licenseError }));
        }
      } catch (licenseError) {
        // If license check fails, still proceed to dashboard
        console.error("License check failed:", licenseError);
      }
      navigate(Capacitor.isNativePlatform() ? "/mobile" : "/", { replace: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyDemoUser = (u) => {
    setEmail(u.email);
    setPassword(u.password);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0A0908]">
      <div className="relative min-h-screen flex flex-col text-cream">
        {/* Top brand strip */}
        <header className="px-8 lg:px-16 pt-10 pb-6 flex items-center justify-between">
          <span className="font-display font-medium tracking-display-tight inline-flex items-baseline gap-0 text-xl" title="SpotyTags">
            <span className="text-cream">Spoty</span>
            <span className="text-brand">Tags</span>
          </span>
          <div className="hidden md:flex items-baseline gap-6">
            <span className="smallcaps text-cream/50">Smart hotel minibar</span>
            <span className="smallcaps text-cream/50 font-mono">v1.0</span>
          </div>
        </header>

        {/* Main layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 px-8 lg:px-16 pb-12 lg:pb-20 gap-16 items-center">

          {/* Left editorial column */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="max-w-2xl reveal">
              <p className="smallcaps text-brand mb-7">An invitation to</p>
              <h1
                className="font-display text-cream"
                style={{
                  fontSize: "clamp(2.6rem, 5.8vw, 5.6rem)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.045em",
                  fontWeight: 700,
                }}
              >
                Welcome to
                <br />
                <span className="accent-serif text-brand" style={{ fontSize: "1.05em" }}>SpotyTags.</span>
              </h1>
              <p className="mt-9 text-base lg:text-lg text-cream/70 max-w-xl leading-relaxed">
                Smart hotel minibar. A quiet hybrid system — local-first where it must be, cloud-aware
                where it should be. Tags whisper, gateways listen, and the bill writes itself.
              </p>
            </div>

            <div className="hidden lg:grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-cream/15 max-w-2xl">
              <div className="space-y-1">
                <p className="smallcaps text-cream/40">Works offline</p>
                <p className="text-base font-semibold tracking-tighter-apple">100% local-first</p>
              </div>
              <div className="space-y-1">
                <p className="smallcaps text-cream/40">Cloud sync</p>
                <p className="text-base font-semibold tracking-tighter-apple">Auto, when up</p>
              </div>
              <div className="space-y-1">
                <p className="smallcaps text-cream/40">Users</p>
                <p className="text-base font-semibold tracking-tighter-apple">Unlimited Users</p>
              </div>
            </div>
          </div>

          {/* Right glass form — Apple-style frosted card */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div
              className="w-full max-w-md relative"
              style={{
                background: "rgba(250, 248, 243, 0.96)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                borderRadius: "28px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.18), 0 24px 60px rgba(0,0,0,0.4), 0 60px 120px rgba(0,0,0,0.3)",
              }}
            >
              <div className="p-10">
                <p className="smallcaps text-ink-500 mb-2">Sign in</p>
                <h2 className="text-3xl font-bold tracking-display-tight text-ink-900">
                  Welcome to <span className="accent-serif text-brand">SpotyTags</span>
                </h2>

                <form onSubmit={handleSubmit} className="mt-9 space-y-6">
                  {err && (
                    <div className="rounded-xl bg-oxblood/8 border border-oxblood/15 px-4 py-3" data-testid="login-error">
                      <p className="smallcaps text-oxblood">Error</p>
                      <p className="text-sm text-ink-900 mt-1">{err}</p>
                    </div>
                  )}

                  <div>
                    <label className="smallcaps block mb-2 text-ink-500">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@spotytags.com"
                      required
                      data-testid="login-email-input"
                      className="w-full bg-white/50 border border-hairline focus:border-ink-900 focus:bg-white focus:shadow-ring-soft outline-none px-4 py-3 text-[15px] text-ink-900 placeholder:text-ink-400 rounded-xl transition-all"
                    />
                  </div>

                  <div>
                    <label className="smallcaps block mb-2 text-ink-500">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        data-testid="login-password-input"
                        className="w-full bg-white/50 border border-hairline focus:border-ink-900 focus:bg-white focus:shadow-ring-soft outline-none px-4 py-3 pr-12 text-[15px] text-ink-900 placeholder:text-ink-400 rounded-xl transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900 transition-colors"
                        data-testid="toggle-password-visibility"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="login-submit-button"
                    className="btn-apple btn-apple-primary w-full mt-2 py-3.5 group"
                  >
                    <span>{loading ? "Authenticating" : "Sign in"}</span>
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />}
                  </button>
                </form>

                {/* Demo accounts — only when demo flag is on */}
                {showDemoDefaults && (
                <div className="mt-9 pt-8 border-t border-hairline-soft">
                  <p className="smallcaps mb-4 text-ink-500">Demo accounts</p>
                  <ul className="space-y-1.5">
                    {DEMO_USERS.map((u, i) => (
                      <li key={u.email}>
                        <button
                          onClick={() => applyDemoUser(u)}
                          type="button"
                          data-testid={`demo-user-${u.role.toLowerCase().replace(/\s+/g, "-")}`}
                          className="w-full flex items-center gap-3 text-left group px-2 py-2 rounded-lg hover:bg-white/60 transition-colors"
                        >
                          <span className="smallcaps text-ink-400 font-mono w-6">{(i + 1).toString().padStart(2, "0")}</span>
                          <span className="flex-1 text-sm font-semibold text-ink-900 group-hover:text-brand transition-colors tracking-tighter-apple">
                            {u.role}
                          </span>
                          <span className="smallcaps text-ink-400 font-mono text-[10px]">{u.email.split("@")[0]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                )}

                {/* Open in native app — deep link */}
                <div className="mt-6 pt-6 border-t border-hairline-soft">
                  <a
                    href="spotytags://login"
                    data-testid="open-mobile-app-link"
                    className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-white/60 transition-colors"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-ink-900 group-hover:text-brand transition-colors tracking-tighter-apple">
                        Open in SpotyTags app
                      </span>
                    </span>
                    <span className="smallcaps text-ink-400 font-mono text-[10px]">android · ios</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-8 lg:px-16 pb-6 pt-4 border-t border-cream/15 flex items-center justify-between text-xs text-cream/40">
          <p>© 2026 SpotyTags. Crafted for hospitality.</p>
          <p className="smallcaps font-mono">V1.0 — The Founding Edition</p>
        </footer>
      </div>
    </div>
  );
}
