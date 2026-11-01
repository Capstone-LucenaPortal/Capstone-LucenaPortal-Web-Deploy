"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Modal } from "@/portals/super-staff/components/ui/modal";

type UnsavedChangesGuard = {
  setDirty: (dirty: boolean) => void;
  // True when the caller may navigate to `href` now. False means the guard
  // has opened the "Discard unsaved changes?" modal and will navigate there
  // itself if the user discards.
  requestLeave: (href: string) => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesGuard | null>(null);

// One guard for the whole portal shell: the page with unsaved edits reports
// dirty, and every in-app way out (config tab rail, sidebar links) asks it
// before leaving. Reload/close is covered by beforeunload. Browser Back/Forward
// is not: App Router can't cancel a popstate navigation.
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const requestLeave = useCallback(
    (href: string) => {
      if (!dirty || href === pathname) return true;
      setPending(href);
      return false;
    },
    [dirty, pathname],
  );

  const guard = useMemo(() => ({ setDirty, requestLeave }), [requestLeave]);

  return (
    <UnsavedChangesContext.Provider value={guard}>
      {children}
      <Modal open={pending !== null} onClose={() => setPending(null)}>
        <h3 className="text-lg font-semibold text-gray-900">
          Discard unsaved changes?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          You have edits on this tab that haven&rsquo;t been saved. Leaving will
          discard them.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPending(null)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const href = pending;
              setPending(null);
              if (href) router.push(href);
            }}
          >
            Discard changes
          </Button>
        </div>
      </Modal>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within an UnsavedChangesProvider");
  }
  return ctx;
}

// Report this page's dirty flag to the guard; it clears when the page unmounts.
export function useReportUnsavedChanges(dirty: boolean) {
  const { setDirty } = useUnsavedChanges();
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}
