import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, bootstrapApi, getServerUrl, onUnauthorized, setToken } from "../api/client";
import { registerAndSubmitPushToken } from "../utils/notifications";

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  super_admin: "Super Admin",
  hotel_admin: "Hotel Admin",
  reception: "Reception",
  housekeeping: "Housekeeping",
  technician: "Technician",
};

export function canAccess(userRole, allowedRoles) {
  if (!userRole) return false;
  if (userRole === "super_admin") return true;
  return allowedRoles.includes(userRole);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking
  const [booted, setBooted] = useState(false);
  const [hasServer, setHasServer] = useState(false);
  const [hotelName, setHotelName] = useState("SpotyTags");
  const [logoUrl, setLogoUrl] = useState(null);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (_e) {
      // ignore — clearing local state regardless
    }
    await setToken(null);
    setUser(false);
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      setToken(null);
      setUser(false);
    });
    (async () => {
      const { hasToken } = await bootstrapApi();
      const serverExists = !!getServerUrl();
      setHasServer(serverExists);
      if (hasToken) {
        try {
          const { data } = await api.get("/auth/me");
          setUser(data);
          // Register this device for system-wide push notifications
          registerAndSubmitPushToken();
        } catch (_e) {
          setUser(false);
        }
      } else {
        setUser(false);
      }
      setBooted(true);
    })();
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const { data } = await api.get("/branding/public");
      if (data?.hotel_name) {
        setHotelName(data.hotel_name);
      }
      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      } else {
        setLogoUrl(null);
      }
    } catch (_e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (booted && hasServer) {
      refreshBranding();
    }
  }, [booted, hasServer, refreshBranding]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    await setToken(data.access_token);
    setUser(data.user);
    // Register device push token upon successful login
    registerAndSubmitPushToken();
    return data.user;
  }, []);

  const getAbsoluteLogoUrl = useCallback(() => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith("http")) return logoUrl;
    const baseUrl = getServerUrl();
    if (!baseUrl) return null;
    return `${baseUrl.replace(/\/+$/, "")}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
  }, [logoUrl]);

  const value = {
    user: user && user !== false ? user : null,
    isAuthed: !!user && user !== false,
    isChecking: user === null,
    booted,
    hasServer,
    setHasServer,
    role: user && user !== false ? user.role : null,
    hotelName,
    logoUrl,
    getAbsoluteLogoUrl,
    refreshBranding,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
