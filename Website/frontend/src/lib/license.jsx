/**
 * License context — exposes plan limits, quotas, and warnings to the whole app.
 *
 * Refetches automatically on websocket events that change resource counts
 * (room_created / tag_created / gateway_created / user_created / license_updated).
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

const LicenseContext = createContext(null);

const EMPTY = {
  status: "unknown",
  plan: null,
  blocked: false,
  block_reason: null,
  expiry_date: null,
  quotas: {},
  warnings: [],
};

export function LicenseProvider({ children }) {
  const { isAuthed } = useAuth();
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthed) return;
    try {
      setLoading(true);
      const { data } = await api.get("/license/validate");
      setSnapshot(data);
    } catch (e) {
      // If the auth layer itself blocked the request due to an expired license,
      // surface that so the modal can show (FastAPI wraps detail one level deep).
      const errDetail = e.response?.data?.detail ?? e.response?.data;
      if (e.response?.status === 403 && errDetail?.code?.startsWith("license_")) {
        const reason = errDetail.license_status || "expired";
        setSnapshot({ ...EMPTY, status: reason, blocked: true, block_reason: reason });
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) {
      setSnapshot(EMPTY);
      return;
    }
    refresh();
    const onChange = () => refresh();
    const events = [
      "spotytags:room_created",
      "spotytags:tag_created",
      "spotytags:gateway_created",
      "spotytags:user_created",
      "spotytags:license_updated",
    ];
    events.forEach((e) => window.addEventListener(e, onChange));
    const interval = setInterval(refresh, 60000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onChange));
      clearInterval(interval);
    };
  }, [isAuthed, refresh]);

  return (
    <LicenseContext.Provider value={{ ...snapshot, loading, refresh }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error("useLicense must be used within LicenseProvider");
  return ctx;
}

export function useQuota(resource) {
  const { quotas } = useLicense();
  return (
    quotas[resource] || {
      current: 0,
      limit: 0,
      remaining: 0,
      pct: 0,
      blocked: false,
      near_limit: false,
    }
  );
}
