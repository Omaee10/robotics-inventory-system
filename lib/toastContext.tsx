"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";

export type ToastType = "success" | "error" | "eject";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      const duration = type === "eject" ? 5000 : 3500;
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast stack — bottom-right corner */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ── Individual toast item ── */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  if (toast.type === "eject") {
    return (
      <div
        className="pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-300 w-96 max-w-[90vw]"
        role="alert"
      >
        <div className="relative flex items-start gap-4 rounded-2xl bg-slate-900 px-5 py-4 shadow-2xl ring-1 ring-white/10">
          {/* Glow accent */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600/20 to-cyan-500/10 pointer-events-none" />

          {/* Drawer icon */}
          <div className="shrink-0 mt-0.5 w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-0.5">
              SUCCESS
            </p>
            <p className="text-white font-semibold text-sm leading-snug">
              {toast.message}
            </p>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="pointer-events-auto shrink-0 text-slate-500 hover:text-white transition-colors mt-0.5"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const isError = toast.type === "error";
  return (
    <div
      className="pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-300 w-80 max-w-[90vw]"
      role="alert"
    >
      <div
        className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium ${
          isError
            ? "bg-red-600 text-white"
            : "bg-slate-800 text-white"
        }`}
      >
        <span className="text-base">{isError ? "✗" : "✓"}</span>
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-white/60 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
