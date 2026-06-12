import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api, getWsUrl } from "./api";
import { useAuth } from "./auth";
import { toast } from "sonner";

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { isAuthed } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const { data } = await api.get("/notifications?limit=50");
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch (_e) {}
  }, [isAuthed]);

  const markAllRead = useCallback(async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (_e) {}
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }
    fetchNotifications();
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
          }
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            handleEvent(msg);
          } catch (_e) {}
        };
        ws.onclose = () => {
          setConnected(false);
          if (!cancelled) {
            reconnectRef.current = setTimeout(connect, 3000);
          }
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch (_e) {}
        };
      } catch (_e) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const handleEvent = (msg) => {
    if (msg.type === "notification") {
      setNotifications((prev) => [msg.payload, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
    }
    // Other event listeners can subscribe via window event bus
    window.dispatchEvent(new CustomEvent("spotytags:" + msg.type, { detail: msg.payload }));
  };

  return (
    <RealtimeContext.Provider value={{ notifications, unreadCount, markAllRead, connected, refresh: fetchNotifications }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}

export function useEventListener(eventType, handler) {
  useEffect(() => {
    const wrapped = (e) => handler(e.detail);
    window.addEventListener("spotytags:" + eventType, wrapped);
    return () => window.removeEventListener("spotytags:" + eventType, wrapped);
  }, [eventType, handler]);
}
