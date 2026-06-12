/**
 * SuperAdmin — local hotel branding & deployment manager.
 *
 * Lets the on-site Super Admin customise every visible piece of the
 * brand without touching code: hotel name, logo, login splash,
 * favicon, brand colours, contact + tax info.  Also surfaces
 * deployment health (uploads folder size, mongo target, cloud-sync url).
 */
import { useEffect, useState, useRef } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import { useBranding, absoluteBrandUrl } from "../lib/branding";
import { useAuth } from "../lib/auth";
import { Surface, SectionHeader } from "../components/Editorial";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Upload, Trash2, RotateCcw, Save, Server, HardDrive, Wifi, Image as ImageIcon,
  Pipette, Check,
} from "lucide-react";
import { cn } from "../lib/utils";

function ColorField({ label, value, onChange, testId }) {
  return (
    <div>
      <Label className="smallcaps">{label}</Label>
      <div className="flex items-center gap-2 mt-2">
        <label className="relative w-10 h-10 rounded-xl border border-hairline cursor-pointer overflow-hidden shadow-apple-sm">
          <input
            type="color"
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            data-testid={`${testId}-input`}
          />
          <span className="absolute inset-0 pointer-events-none" style={{ backgroundColor: value }} />
        </label>
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono text-sm uppercase max-w-[140px]"
          data-testid={`${testId}-text`}
        />
        <Pipette className="w-3.5 h-3.5 text-ink-400" />
      </div>
    </div>
  );
}

function ImageUploader({ kind, label, hint, currentUrl, onChange, aspect = "aspect-video" }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 5 MB" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(`/branding/upload?kind=${kind}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${label} uploaded`);
      onChange?.(data.url);
    } catch (e) {
      toast.error("Upload failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async () => {
    try {
      await api.delete(`/branding/${kind}`);
      toast.success(`${label} removed`);
      onChange?.(null);
    } catch (e) {
      toast.error("Failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    } finally {
      setRemoveOpen(false);
    }
  };

  const resolved = absoluteBrandUrl(currentUrl);

  return (
    <div data-testid={`brand-uploader-${kind}`}>
      <Label className="smallcaps">{label}</Label>
      <p className="text-xs text-ink-500 mt-1 mb-3 max-w-md">{hint}</p>
      <div
        className={cn(
          "relative border border-dashed border-hairline rounded-2xl bg-white overflow-hidden shadow-apple-sm",
          aspect,
        )}
      >
        {resolved ? (
          <img src={resolved} alt={label} className="absolute inset-0 w-full h-full object-contain p-3"
               data-testid={`brand-${kind}-preview`} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-300">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-ink-900/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-apple text-xs px-3 py-2 bg-cream text-ink-900"
            disabled={uploading}
            data-testid={`brand-${kind}-upload-btn`}
          >
            <Upload className="w-3 h-3" /> {uploading ? "Uploading…" : (resolved ? "Replace" : "Upload")}
          </button>
          {resolved && (
            <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="btn-apple text-xs px-3 py-2 bg-oxblood/90 text-cream"
                  data-testid={`brand-${kind}-remove-btn`}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {label.toLowerCase()}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The image file will be deleted from the local server. You can upload a new one anytime.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`brand-${kind}-remove-cancel`}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={removeFile}
                    className="bg-oxblood hover:bg-oxblood/90"
                    data-testid={`brand-${kind}-remove-confirm`}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/gif"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
        data-testid={`brand-${kind}-file-input`}
      />
    </div>
  );
}

function DeploymentInfo({ info }) {
  if (!info) return null;
  const sizeMb = ((info.uploads?.total_bytes || 0) / 1024 / 1024).toFixed(2);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-5" data-testid="deployment-info">
      <div>
        <p className="smallcaps flex items-center gap-1.5"><Server className="w-3 h-3" /> Mode</p>
        <p className="ticking-num text-3xl text-ink-900 mt-1 capitalize">{info.deployment_mode}</p>
        <p className="smallcaps text-ink-400 mt-1 font-mono">{info.property_id}</p>
      </div>
      <div>
        <p className="smallcaps flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> Storage</p>
        <p className="ticking-num text-3xl text-ink-900 mt-1 tabular">{sizeMb} <span className="text-base">MB</span></p>
        <p className="smallcaps text-ink-400 mt-1 font-mono">{info.uploads?.files} files</p>
      </div>
      <div>
        <p className="smallcaps flex items-center gap-1.5"><Wifi className="w-3 h-3" /> Cloud sync</p>
        <p className="text-xl font-bold mt-1 tracking-tighter-apple truncate">
          {info.cloud_sync?.default_uses_localhost_mock ? "Local-only mock" : "Cloud configured"}
        </p>
        <p className="smallcaps text-ink-400 mt-1 font-mono truncate">{info.cloud_sync?.configured_url || "(default)"}</p>
      </div>
      <div>
        <p className="smallcaps">Live entities</p>
        <p className="text-xl font-bold mt-1 tabular">
          {info.users_count} users · {info.rooms_count} rooms
        </p>
        <p className="smallcaps text-ink-400 mt-1 font-mono">{info.tags_count} tags · {info.gateways_count} gateways</p>
      </div>
    </div>
  );
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const branding = useBranding();
  const [form, setForm] = useState(null);
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  // Populate form from current brand (authenticated read gives full info)
  useEffect(() => {
    api.get("/branding").then((r) => setForm(r.data)).catch(() => {});
    api.get("/branding/deployment-info").then((r) => setInfo(r.data)).catch(() => {});
  }, []);

  if (user.role !== "super_admin") {
    return (
      <div className="py-20 text-center">
        <p className="smallcaps text-oxblood">This page is for Super Admin only.</p>
      </div>
    );
  }

  if (!form) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}</div>;
  }

  const updateField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        hotel_name: form.hotel_name,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        address: form.address,
        website: form.website,
        gst_number: form.gst_number,
        registration_number: form.registration_number,
      };
      const { data } = await api.put("/branding", payload);
      setForm(data);
      branding.refresh();
      window.dispatchEvent(new Event("spotytags:branding_updated"));
      setSavedAt(new Date());
      toast.success("Brand saved");
    } catch (e) {
      toast.error("Failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    try {
      const { data } = await api.post("/branding/reset");
      setForm(data);
      branding.refresh();
      window.dispatchEvent(new Event("spotytags:branding_updated"));
      toast.success("Brand reset to defaults");
    } catch (e) {
      toast.error("Failed", { description: formatApiErrorDetail(e.response?.data?.detail) || e.message });
    } finally {
      setResetOpen(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="super-admin-page">
      {/* Hero */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="smallcaps">Local Super Admin · this deployment</p>
            <h1 className="text-3xl lg:text-5xl font-bold tracking-display-tight leading-tight mt-0.5">
              The brand, <span className="accent-serif text-brand">in your hands.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
              <AlertDialogTrigger asChild>
                <button className="btn-apple btn-apple-secondary text-xs" data-testid="reset-brand-button">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset brand to defaults?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This restores SpotyTags defaults and removes any uploaded logo, splash, or favicon
                    from the server. Saved colours and contact info are reset too.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="reset-brand-cancel">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={resetAll}
                    className="bg-oxblood hover:bg-oxblood/90"
                    data-testid="reset-brand-confirm"
                  >
                    Reset everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <button onClick={save} disabled={saving} className="btn-apple btn-apple-primary text-xs" data-testid="save-brand-button">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <div className="hairline" />
        {savedAt && (
          <p className="smallcaps text-status-success flex items-center gap-1.5">
            <Check className="w-3 h-3" /> Saved {savedAt.toLocaleTimeString()}
          </p>
        )}
      </header>

      {/* Deployment info */}
      <Surface padding="p-6 lg:p-8">
        <p className="smallcaps mb-3">Deployment</p>
        <p className="font-display italic text-ink-600 mb-6">A snapshot of how this copy runs — useful when the IT team is on the line.</p>
        <div className="hairline mb-6" />
        <DeploymentInfo info={info} />
      </Surface>

      {/* Identity */}
      <Surface padding="p-6 lg:p-8">
        <p className="smallcaps mb-3">Identity</p>
        <p className="font-display italic text-ink-600 mb-6">The name guests recognise, the tone they hear at the front desk.</p>
        <div className="hairline mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5">
          <div>
            <Label className="smallcaps">Hotel name *</Label>
            <Input value={form.hotel_name || ""} onChange={(e) => updateField("hotel_name", e.target.value)}
              placeholder="Spoty Grand Hotel" className="mt-2 text-2xl font-bold tracking-tighter-apple border-0 border-b border-hairline rounded-none bg-transparent focus:border-ink-900 px-0"
              data-testid="brand-hotel-name" />
          </div>
          <div>
            <Label className="smallcaps">Website</Label>
            <Input value={form.website || ""} onChange={(e) => updateField("website", e.target.value)}
              placeholder="https://yourhotel.com" className="mt-2 font-mono text-sm" data-testid="brand-website" />
          </div>
        </div>
      </Surface>

      {/* Imagery */}
      <Surface padding="p-6 lg:p-8">
        <p className="smallcaps mb-3">Imagery</p>
        <p className="font-display italic text-ink-600 mb-6">Upload a logo and a small icon for the browser tab.</p>
        <div className="hairline mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ImageUploader
            kind="logo"
            label="Logo"
            hint="Used in the sidebar, login screen, and across the app. Transparent PNG or SVG works best. Max 5 MB."
            currentUrl={branding.logo_url}
            onChange={() => branding.refresh()}
            aspect="aspect-square"
          />
          <ImageUploader
            kind="favicon"
            label="Favicon"
            hint="Browser tab + bookmark icon. 32×32 .ico or .png."
            currentUrl={branding.favicon_url}
            onChange={() => branding.refresh()}
            aspect="aspect-square"
          />
        </div>
      </Surface>

      {/* Colours */}
      <Surface padding="p-6 lg:p-8">
        <p className="smallcaps mb-3">Colours</p>
        <p className="font-display italic text-ink-600 mb-6">A primary for backgrounds, an accent for the action-yes buttons.</p>
        <div className="hairline mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <ColorField label="Primary" value={form.primary_color} onChange={(v) => updateField("primary_color", v)} testId="primary-color" />
          <ColorField label="Accent" value={form.accent_color} onChange={(v) => updateField("accent_color", v)} testId="accent-color" />
          <div className="space-y-3">
            <p className="smallcaps">Preview</p>
            <div className="rounded-2xl overflow-hidden border border-hairline shadow-apple-sm">
              <div className="h-12" style={{ backgroundColor: form.primary_color }} />
              <div className="bg-white p-4 flex items-baseline justify-between">
                <span className="font-bold tracking-tighter-apple">{form.hotel_name}</span>
                <button
                  className="px-3 py-1.5 rounded-lg text-cream text-xs font-medium"
                  style={{ backgroundColor: form.accent_color }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      {/* Contact + legal */}
      <Surface padding="p-6 lg:p-8">
        <p className="smallcaps mb-3">Contact & legal</p>
        <p className="font-display italic text-ink-600 mb-6">Used on invoices, receipts, and the footer of every printed page.</p>
        <div className="hairline mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5">
          <div>
            <Label className="smallcaps">Email</Label>
            <Input type="email" value={form.contact_email || ""} onChange={(e) => updateField("contact_email", e.target.value)}
              placeholder="reception@yourhotel.com" className="mt-2" data-testid="brand-email" />
          </div>
          <div>
            <Label className="smallcaps">Phone</Label>
            <Input value={form.contact_phone || ""} onChange={(e) => updateField("contact_phone", e.target.value)}
              placeholder="+91 80 1234 5678" className="mt-2 font-mono" data-testid="brand-phone" />
          </div>
          <div className="lg:col-span-2">
            <Label className="smallcaps">Address</Label>
            <Input value={form.address || ""} onChange={(e) => updateField("address", e.target.value)}
              placeholder="123 MG Road, Bangalore, India" className="mt-2" data-testid="brand-address" />
          </div>
          <div>
            <Label className="smallcaps">GST / VAT number</Label>
            <Input value={form.gst_number || ""} onChange={(e) => updateField("gst_number", e.target.value)}
              placeholder="29ABCDE1234F1Z5" className="mt-2 font-mono uppercase" data-testid="brand-gst" />
          </div>
          <div>
            <Label className="smallcaps">Registration #</Label>
            <Input value={form.registration_number || ""} onChange={(e) => updateField("registration_number", e.target.value)}
              placeholder="CIN: U70200KA…" className="mt-2 font-mono" data-testid="brand-registration" />
          </div>
        </div>
      </Surface>

      {/* Saved indicator at bottom */}
      <div className="text-center pt-4">
        <SectionHeader
          overline="Local-first"
          title={<>One install, <span className="italic text-brand">one hotel.</span></>}
          lead="Every byte stored on this server, every image on this disk. No cloud is required for the system to run — sync is purely optional."
        />
      </div>
    </div>
  );
}
