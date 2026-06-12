import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getWsUrl } from "../api/client";
import { useAuth } from "./AuthContext";

const RealtimeContext = createContext({ connected: false });

export function RealtimeProvider({ children }) {
  const { isAuthed } = useAuth();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    if (!isAuthed) {
      if (wsRef.current) wsRef.current.close();
      setConnected(false);
      return;
    }
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const url = getWsUrl();
      if (!url) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          if (reconnectRef.current) clearTimeout(reconnectRef.current);
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "notification") {
              const payload = data.payload;
              // Only show housekeeping restock requests as notifications (restock + warning)
              if (payload?.type === "restock" && payload?.severity === "warning") {
                try {
                  Notifications.scheduleNotificationAsync({
                    content: {
                      title: payload.title,
                      body: payload.message,
                      sound: true,
                    },
                    trigger: null, // immediately
                  });
                } catch (notiErr) {
                  console.warn("Failed to schedule local notification:", notiErr);
                }
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        };
        ws.onclose = () => {
          setConnected(false);
          if (!cancelled) reconnectRef.current = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch (_e) {
            // ignore
          }
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
  }, [isAuthed]);

  return <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
