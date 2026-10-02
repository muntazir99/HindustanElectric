import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import api from "../api.js";

const AuthContext = createContext(null);

function userFromToken(token) {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 > Date.now() ? { token, role: decoded.role } : null;
  } catch {
    return null;
  }
}

function savedAccess() {
  try {
    return JSON.parse(localStorage.getItem("access")) || [];
  } catch {
    return [];
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loggedIn = useRef(false);

  // The owner can change someone's switches at any time, so ask the server, not only at login.
  const refreshAccess = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      const { role, name, access } = data.data;
      localStorage.setItem("access", JSON.stringify(access));
      setUser((current) =>
        current && (current.role !== role || current.name !== name || current.access.join() !== access.join())
          ? { ...current, role, name, access }
          : current
      );
    } catch {
      /* No connection: keep the last known switches. An expired login is sent to the login page by api.js. */
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const found = token ? userFromToken(token) : null;
    if (!found) {
      if (token) localStorage.clear();
      setLoading(false);
      return;
    }
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    loggedIn.current = true;
    setUser({ ...found, access: savedAccess() });
    refreshAccess().finally(() => setLoading(false));
  }, [refreshAccess]);

  // Coming back to the window (another tab, after a break): pick up switch changes.
  useEffect(() => {
    const onFocus = () => loggedIn.current && refreshAccess();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshAccess]);

  const login = (token, info = {}) => {
    const found = userFromToken(token);
    if (!found) return;
    const access = info.access || [];
    localStorage.setItem("token", token);
    localStorage.setItem("role", found.role);
    localStorage.setItem("access", JSON.stringify(access));
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    loggedIn.current = true;
    setUser({ ...found, name: info.name, access });
  };

  const logout = () => {
    localStorage.clear();
    loggedIn.current = false;
    setUser(null);
    delete api.defaults.headers.common.Authorization;
  };

  const isOwner = user?.role === "owner";
  /** May this person do any of these jobs (accounts switches)? The owner can do everything. */
  const can = (...codes) => isOwner || codes.some((code) => user?.access?.includes(code));

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout, isOwner, can, refreshAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
