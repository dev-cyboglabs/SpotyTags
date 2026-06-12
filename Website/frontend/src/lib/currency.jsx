/**
 * Currency context — exposes the property's currency + a `format` helper
 * used everywhere a monetary amount is rendered.
 *
 * Uses native `Intl.NumberFormat` so digit-grouping + decimal style match
 * the locale (e.g. INR shows lakhs/crores, EUR uses dot-then-comma, JPY
 * has no decimals).
 *
 * Backwards-compatible default: INR / en-IN / ₹.
 */
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

const FALLBACK = {
  code: "INR",
  symbol: "₹",
  name: "Indian Rupee",
  locale: "en-IN",
  decimals: 2,
};

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const { isAuthed } = useAuth();
  const [current, setCurrent] = useState(FALLBACK);
  const [country, setCountry] = useState(null);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [available, setAvailable] = useState([]);

  const refresh = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const { data } = await api.get("/settings/currency");
      setCurrent(data.current || FALLBACK);
      setCountry(data.country || null);
      setTimezone(data.timezone || "Asia/Kolkata");
      setAvailable(data.available || []);
    } catch (_e) {
      // silent — fall back to defaults
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    refresh();
    const onChange = () => refresh();
    window.addEventListener("spotytags:currency_updated", onChange);
    return () => window.removeEventListener("spotytags:currency_updated", onChange);
  }, [isAuthed, refresh]);

  /**
   * Number formatter (locale-aware grouping + decimals) — NOT currency
   * formatter. We always prefix our own symbol so that ambiguous locales
   * (e.g. en-SG which collapses "S$" to "$") still show the right glyph.
   */
  const formatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(current.locale, {
        style: "decimal",
        maximumFractionDigits: current.decimals ?? 2,
        minimumFractionDigits: 0,
      });
    } catch (_e) {
      return new Intl.NumberFormat("en-IN", { style: "decimal" });
    }
  }, [current]);

  /** Format any number into the current currency. Falls back to `symbol + number`. */
  const format = useCallback(
    (amount, opts = {}) => {
      if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
      const n = typeof amount === "number" ? amount : parseFloat(amount);
      if (Number.isNaN(n)) return "—";
      try {
        if (opts.short && Math.abs(n) >= 1000) {
          if (Math.abs(n) >= 1_000_000) return `${current.symbol}${(n / 1_000_000).toFixed(1)}M`;
          return `${current.symbol}${(n / 1000).toFixed(1)}k`;
        }
        return `${current.symbol}${formatter.format(n)}`;
      } catch (_e) {
        return `${current.symbol}${n.toLocaleString(current.locale)}`;
      }
    },
    [formatter, current]
  );

  /** Just the symbol, e.g. "₹", "$", "€". */
  const symbol = current.symbol;

  return (
    <CurrencyContext.Provider value={{ current, symbol, format, country, timezone, available, refresh }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

/** Pure helper for components that can't use the hook (e.g. column defs). */
export function formatWithFallback(amount, currency = FALLBACK) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  try {
    const num = new Intl.NumberFormat(currency.locale, {
      style: "decimal",
      maximumFractionDigits: currency.decimals ?? 2,
      minimumFractionDigits: 0,
    }).format(amount);
    return `${currency.symbol}${num}`;
  } catch (_e) {
    return `${currency.symbol}${amount}`;
  }
}
