import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

const EMPTY = { blocked: false, block_reason: null, status: "no_license" };

/** Hook to check license status from /license/validate */
export function useLicenseStatus() {
  const [license, setLicense] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const checkLicense = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/license/validate");
      setLicense({
        blocked: data.blocked || false,
        block_reason: data.block_reason || null,
        status: data.status || "no_license",
        expiry_date: data.expiry_date || null,
        plan: data.plan || null,
      });
    } catch (e) {
      // If request fails, assume not blocked (fail-open for network issues)
      setLicense(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkLicense();
  }, [checkLicense]);

  return { ...license, loading, checkLicense };
}

/** Provider wrapper for license status (optional, for future use) */
export function LicenseProvider({ children }) {
  return <>{children}</>;
}
