"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserSession } from "./types";

interface SessionContextValue {
  session: UserSession | null;
  /** True after we have read localStorage on the client (never true during SSR). */
  sessionHydrated: boolean;
  setSession: (s: UserSession) => void;
  logout: () => void;
}

const SESSION_KEY = "robotics_session";

const SessionContext = createContext<SessionContextValue>({
  session: null,
  sessionHydrated: false,
  setSession: () => {},
  logout: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<UserSession | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setSessionState(JSON.parse(stored));
    } catch {
      // ignore parse errors
    } finally {
      setSessionHydrated(true);
    }
  }, []);

  const setSession = useCallback((s: UserSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSessionState(s);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionState(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, sessionHydrated, setSession, logout }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
