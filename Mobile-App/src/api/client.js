import axios from "axios";
import * as SecureStore from "expo-secure-store";

const ENV_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");

let serverUrl = ENV_URL;
let token = null;
let unauthorizedHandler = null;

export const api = axios.create({
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

api.interceptors.request.use((cfg) => {
  cfg.baseURL = `${serverUrl.replace(/\/+$/, "")}/api`;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || "";
    if (status === 401 && !url.includes("/auth/login") && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(err);
  }
);

export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

/** Load persisted server URL + token from secure storage on launch. */
export async function bootstrapApi() {
  try {
    const storedUrl = await SecureStore.getItemAsync("server_url");
    if (storedUrl) serverUrl = storedUrl;
    const storedToken = await SecureStore.getItemAsync("access_token");
    if (storedToken) token = storedToken;
  } catch (_e) {
    // first launch — nothing stored yet
  }
  return { serverUrl, hasToken: !!token };
}

export function getServerUrl() {
  return serverUrl;
}

export async function setServerUrl(url) {
  serverUrl = (url || "").replace(/\/+$/, "");
  await SecureStore.setItemAsync("server_url", serverUrl);
}

export async function setToken(t) {
  token = t;
  if (t) await SecureStore.setItemAsync("access_token", t);
  else await SecureStore.deleteItemAsync("access_token");
}

export function getToken() {
  return token;
}

/** Derive the websocket URL from the active server URL. */
export function getWsUrl() {
  if (!serverUrl) return null;
  try {
    const u = new URL(serverUrl);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}/api/ws`;
  } catch (_e) {
    return null;
  }
}

export function apiErrorMessage(err, fallback = "Something went wrong") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && e.msg) || JSON.stringify(e)).join(" ");
  }
  if (detail && detail.message) return detail.message;
  return err?.message || fallback;
}
