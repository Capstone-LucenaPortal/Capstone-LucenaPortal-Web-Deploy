"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import type { ConfigChange } from "../lib/diff";
import type { ConfigErrors } from "../lib/validation";

export type ConfigEditor<T> = {
  draft: T | null;
  saved: T | null;
  /**
   * A load that failed, already turned into copy. `draft === null` must NOT be
   * read as "still loading" any more: null-and-no-error is loading, and
   * null-with-an-error is a load that failed. Views render error first.
   *
   * There is deliberately no `loading` flag to match `useCatalogEditor`'s.
   * That hook needs one because its `rows: T[]` starts as `[]`, which is
   * indistinguishable from a catalog that really is empty. `draft: T | null`
   * carries the same fact already, so a flag here would be a second source of
   * truth for it.
   */
  error: string | null;
  update: (patch: Partial<T>) => void;
  setDraft: (next: T) => void;
  errors: ConfigErrors;
  changes: ConfigChange[];
  dirty: boolean;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  saving: boolean;
  requestSave: () => void;
  confirmSave: () => void;
  reset: () => void;
};

export function useConfigEditor<T>({
  load,
  diff,
  validate,
  commit,
  moduleLabel,
}: {
  load: () => Promise<T>;
  diff: (before: T, after: T) => ConfigChange[];
  validate: (draft: T) => ConfigErrors;
  /**
   * There is no actor argument any more — `write_audit` reads `auth.uid()` from
   * the caller's JWT — and `before` is unused because the RPC computes its own
   * diff server-side. Pass a MODULE-SCOPE function: the load effect depends on
   * `load` and a fresh identity each render re-fetches forever.
   */
  commit: (after: T) => Promise<T>;
  moduleLabel: string;
}): ConfigEditor<T> {
  const { toast } = useToast();
  const [saved, setSaved] = useState<T | null>(null);
  const [draft, setDraftState] = useState<T | null>(null);
  const [errors, setErrors] = useState<ConfigErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    load()
      .then((c) => {
        if (!active) return;
        setSaved(c);
        setDraftState(c);
      })
      .catch((e: unknown) => {
        if (!active) return;
        // The `super_*_config` views return ZERO rows to anyone who is not an
        // active super_staff, which `.single()` raises as PGRST116 and the
        // error seam classifies as `permission`. Without this the view spun
        // forever on an unhandled rejection.
        setLoadError(
          rpcErrorMessage(e, `Could not load the ${moduleLabel} configuration.`),
        );
      });
    return () => {
      active = false;
    };
  }, [load, moduleLabel]);

  const changes = useMemo(
    () => (saved && draft ? diff(saved, draft) : []),
    [saved, draft, diff],
  );
  const dirty = changes.length > 0;

  const update = useCallback((patch: Partial<T>) => {
    setDraftState((d) => (d ? { ...d, ...patch } : d));
  }, []);

  const setDraft = useCallback((next: T) => setDraftState(next), []);

  const reset = useCallback(() => {
    setDraftState(saved);
    setErrors({});
  }, [saved]);

  const requestSave = useCallback(() => {
    if (!draft) return;
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast("Fix the highlighted fields.", "error");
      return;
    }
    if (!dirty) {
      toast("No changes to save.", "info");
      return;
    }
    setConfirmOpen(true);
  }, [draft, validate, dirty, toast]);

  const confirmSave = useCallback(async () => {
    if (!saved || !draft) return;
    setSaving(true);
    try {
      const next = await commit(draft);
      setSaved(next);
      setDraftState(next);
      setConfirmOpen(false);
      toast(`${moduleLabel} configuration saved.`, "success");
    } catch (e: unknown) {
      toast(rpcErrorMessage(e, "Could not save. Try again."), "error");
    } finally {
      setSaving(false);
    }
  }, [saved, draft, commit, moduleLabel, toast]);

  return {
    draft,
    saved,
    error: loadError,
    update,
    setDraft,
    errors,
    changes,
    dirty,
    confirmOpen,
    setConfirmOpen,
    saving,
    requestSave,
    confirmSave,
    reset,
  };
}
