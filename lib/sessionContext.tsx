"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Program, UserSession } from "./types";

function normalizeStoredSession(raw: unknown): UserSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const role = o.role;
  const name = o.name;
  if (role !== "student" && role !== "mentor") return null;
  if (typeof name !== "string" || !name.trim()) return null;
  const program: Program = o.program === "ftc" ? "ftc" : "frc";
  return { role, name: name.trim(), program };
}

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
      if (stored) {
        const parsed = normalizeStoredSession(JSON.parse(stored));
        if (parsed) setSessionState(parsed);
      }
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
