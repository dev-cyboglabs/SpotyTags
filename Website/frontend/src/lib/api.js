import axios from "axios";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8001").replace(/\/+$/, "");
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Auto-retry on 401 with refresh once
let refreshing = false;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config || {};
    if (err.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      if (!refreshing) {
        refreshing = true;
        try {
          await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        } catch (_e) {
          // fall-through
        } finally {
          refreshing = false;
        }
      }
      return api(original);
    }
    // Handle license expiry errors globally.
    // FastAPI wraps detail as { detail: { code, ... } }; guard both shapes.
    if (err.response?.status === 403) {
      const errDetail = err.response.data?.detail ?? err.response.data;
      if (errDetail?.code?.startsWith("license_")) {
        window.__licenseError = errDetail;
        window.dispatchEvent(new CustomEvent("license-expired", { detail: errDetail }));
      }
    }
    return Promise.reject(err);
  }
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.message === "string") return detail.message;
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function getWsUrl() {
  const url = new URL(BACKEND_URL);
  const proto = url.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${url.host}/api/ws`;
}
