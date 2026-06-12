import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

const EMPTY = { current: 0, limit: 0, remaining: 0, blocked: false, near_limit: false };

/** Lightweight quota hook — reads /license/validate and returns the slice for `resource`. */
export function useQuota(resource) {
  const [quota, setQuota] = useState(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/license/validate");
      setQuota(data.quotas?.[resource] || EMPTY);
    } catch (_e) {
      // license unreachable — leave defaults (limit 0 hides the banner)
    }
  }, [resource]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...quota, refresh };
}
