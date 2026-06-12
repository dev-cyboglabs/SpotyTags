import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = guest, object = user
  const [error, setError] = useState(null);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (_e) {
      setUser(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = formatApiErrorDetail(e.response?.data?.detail) || e.message;
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout API call failed (clearing local state anyway):", err?.message || err);
    }
    setUser(false);
  }, []);

  const value = {
    user,
    error,
    setError,
    login,
    logout,
    refresh: fetchMe,
    isLoading: user === null,
    isAuthed: !!user && user !== false,
    role: user && user !== false ? user.role : null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

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
