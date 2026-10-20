"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast } from "@/portals/super-staff/components/ui/toast";

type ToastVariant = "success" | "error" | "info" | "warning";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<{
  toast: (message: string, variant?: ToastVariant) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <Toast key={t.id} message={t.message} variant={t.variant} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
