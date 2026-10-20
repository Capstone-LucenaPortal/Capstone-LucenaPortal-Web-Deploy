"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/portals/responder/lib/utils";

type ToastTone = "neutral" | "info";

interface ToastState {
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "neutral") =>
      setToast({ message, tone }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className="animate-toast-in pointer-events-none fixed inset-x-0 bottom-5 z-90 flex justify-center px-4">
          <div
            role="status"
            data-on-dark={toast.tone === "info" ? undefined : true}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg",
              toast.tone === "info"
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-gray-700 bg-gray-900 text-white",
            )}
          >
            <span className="flex-1 text-[13.5px] font-semibold text-pretty">
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="shrink-0 text-[15px] leading-none opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
