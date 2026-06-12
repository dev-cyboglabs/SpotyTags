import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const FALLBACK = { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN", decimals: 2 };

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const { isAuthed } = useAuth();
  const [current, setCurrent] = useState(FALLBACK);

  const refresh = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const { data } = await api.get("/settings/currency");
      setCurrent(data.current || FALLBACK);
    } catch (_e) {
      // silent fallback
    }
  }, [isAuthed]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const format = useCallback(
    (amount) => {
      if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
      const n = typeof amount === "number" ? amount : parseFloat(amount);
      if (Number.isNaN(n)) return "—";
      try {
        const num = new Intl.NumberFormat(current.locale, {
          style: "decimal",
          maximumFractionDigits: current.decimals ?? 2,
          minimumFractionDigits: 0,
        }).format(n);
        return `${current.symbol}${num}`;
      } catch (_e) {
        return `${current.symbol}${n}`;
      }
    },
    [current]
  );

  return (
    <CurrencyContext.Provider value={{ current, symbol: current.symbol, format, refresh }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
