/**
 * BrandingProvider — exposes the hotel's brand (name, logo, colours, etc.)
 * across the whole app.  The public endpoint is fetched before login so
 * the Login screen also shows the hotel's identity.
 *
 * On `branding_updated` websocket events the context auto-refreshes so
 * an edit in /super-admin takes effect everywhere instantly.
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, API_BASE } from "./api";

const DEFAULT = {
  hotel_name: "SpotyTags",
  primary_color: "#1A1A1A",
  accent_color: "#FF7E6B",
  logo_url: null,
  favicon_url: null,
  contact_email: "",
  contact_phone: "",
  address: "",
  gst_number: "",
  registration_number: "",
  website: "",
};

const BrandingContext = createContext(null);

/** Resolve a brand image URL (which may be a relative /api/branding/files/...
 * path returned by the backend) into a fully-qualified URL that works in
 * both the web app and the native Capacitor app. */
export function absoluteBrandUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  // API_BASE is the REACT_APP_BACKEND_URL configured value (no trailing slash)
  if (url.startsWith("/api/")) return `${API_BASE.replace(/\/api\/?$/, "")}${url}`;
  return `${API_BASE.replace(/\/api\/?$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function BrandingProvider({ children }) {
  const [brand, setBrand] = useState(DEFAULT);

  const refresh = useCallback(async () => {
    try {
      // Public brand works without auth — fall back if private call fails
      const { data } = await api.get("/branding/public");
      setBrand({ ...DEFAULT, ...data });
    } catch (_e) {
      // silent — keep defaults so app still renders
    }
  }, []);

  const refreshFull = useCallback(async () => {
    try {
      const { data } = await api.get("/branding");
      setBrand({ ...DEFAULT, ...data });
      return data;
    } catch (_e) {
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => { refresh(); };
    window.addEventListener("spotytags:branding_updated", onChange);
    return () => window.removeEventListener("spotytags:branding_updated", onChange);
  }, [refresh]);

  // Apply brand colours + title + favicon to the document
  useEffect(() => {
    const root = document.documentElement;
    if (brand.primary_color) {
      root.style.setProperty("--brand-primary", brand.primary_color);
    }
    if (brand.accent_color) {
      root.style.setProperty("--brand-accent", brand.accent_color);
    }
    if (brand.hotel_name) document.title = brand.hotel_name;
    if (brand.favicon_url) {
      const url = absoluteBrandUrl(brand.favicon_url);
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = url;
    }
  }, [brand]);

  return (
    <BrandingContext.Provider value={{ ...brand, refresh, refreshFull }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
