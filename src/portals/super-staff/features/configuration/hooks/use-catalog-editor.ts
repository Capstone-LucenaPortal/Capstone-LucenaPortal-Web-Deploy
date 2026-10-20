"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import type { ConfigErrors } from "../lib/validation";

/**
 * The default `keyOf`. Every catalog row but site-info's is keyed by the TEXT
 * `code` that migrations own.
 *
 * It lives here rather than in `use-catalog-editors` because the announcements
 * category editor needs it too, and that module mounts the six CONFIGURATION
 * editors — importing it from there would drag six unrelated hooks across a
 * feature line for a one-line accessor. This module is the one announcements
 * already depends on.
 */
export const byCode = (r: { code: string }) => r.code;

export type CatalogEditor<T> = {
  rows: T[];
  loading: boolean;
  error: string | null;
  /** Codes with unsaved edits — the tab-rail guard unions these with the
   *  scalar form's dirty flag. */
  dirtyKeys: Set<string>;
  savingKey: string | null;
  /**
   * Field errors for rows whose save was refused, keyed by row key. Same
   * `ConfigErrors` currency the scalar forms use, so a row renders its errors
   * the way a config field does.
   */
  rowErrors: Record<string, ConfigErrors>;
  update: (key: string, patch: Partial<T>) => void;
  save: (key: string) => Promise<void>;
  revert: (key: string) => void;
  /** Refetch after a write the hook did not make — a row added elsewhere. */
  reload: () => Promise<void>;
};

/**
 * Scalars save as one transaction; a catalog row is its own RPC call. That is
 * why this cannot reuse use-config-editor, whose contract is one draft object.
 *
 * ⚠️ Pass MODULE-SCOPE load/commit/keyOf functions, never inline closures — the
 * load effect depends on `load`, and a new identity each render re-fetches
 * forever. This is the same trap use-config-editor documents.
 */
export function useCatalogEditor<T>({
  load,
  commit,
  validate,
  keyOf,
  label,
  errorMessage = rpcErrorMessage,
  onSaved,
}: {
  load: () => Promise<T[]>;
  commit: (row: T) => Promise<void>;
  /**
   * Runs before every commit, exactly as `useConfigEditor.requestSave` runs its
   * own `validate` before opening the confirm modal. Not optional: these RPCs
   * are FULL REPLACES with no argument defaults, so a cleared number input
   * (`valueAsNumber` === NaN) would otherwise reach the database as `null`.
   * Module scope, like its siblings.
   */
  validate: (row: T) => ConfigErrors;
  keyOf: (row: T) => string;
  label: string;
  /** Toast copy for a caught error. Defaults to the shared seam's. */
  errorMessage?: (error: unknown, fallback: string) => string;
  /** Runs once a commit has landed, for state that lives beside the rows. */
  onSaved?: () => void;
}): CatalogEditor<T> {
  const { toast } = useToast();
  const [saved, setSaved] = useState<T[]>([]);
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, ConfigErrors>>({});

  const refresh = useCallback(async () => {
    const fresh = await load();
    setSaved(fresh);
    setRows(fresh);
  }, [load]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then((fresh) => {
        if (!active) return;
        setSaved(fresh);
        setRows(fresh);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(errorMessage(e, `Could not load ${label}.`));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, label, errorMessage]);

  const dirtyKeys = new Set(
    rows
      .filter((r) => {
        const before = saved.find((s) => keyOf(s) === keyOf(r));
        return before && JSON.stringify(before) !== JSON.stringify(r);
      })
      .map(keyOf),
  );

  /**
   * Editing a refused row clears its errors — the highlight described the
   * value that was rejected, not the one being typed.
   *
   * Returns the SAME object when there is nothing to clear, which is the
   * common case: this runs on every keystroke, and a fresh object each time
   * would re-render the whole card for every character typed in any catalog.
   */
  const clearRowErrors = useCallback((key: string) => {
    setRowErrors((e) => {
      if (!(key in e)) return e;
      const { [key]: _cleared, ...rest } = e;
      return rest;
    });
  }, []);

  const update = useCallback(
    (key: string, patch: Partial<T>) => {
      clearRowErrors(key);
      setRows((rs) => rs.map((r) => (keyOf(r) === key ? { ...r, ...patch } : r)));
    },
    [keyOf, clearRowErrors],
  );

  const revert = useCallback(
    (key: string) => {
      clearRowErrors(key);
      setRows((rs) =>
        rs.map((r) => (keyOf(r) === key ? (saved.find((s) => keyOf(s) === key) ?? r) : r)),
      );
    },
    [saved, keyOf, clearRowErrors],
  );

  const save = useCallback(
    async (key: string) => {
      const row = rows.find((r) => keyOf(r) === key);
      if (!row) return;

      const found = validate(row);
      if (Object.keys(found).length > 0) {
        setRowErrors((e) => ({ ...e, [key]: found }));
        toast("Fix the highlighted fields.", "error");
        return;
      }

      setSavingKey(key);
      try {
        await commit(row);
      } catch (e: unknown) {
        toast(errorMessage(e, "Could not save. Try again."), "error");
        setSavingKey(null);
        return;
      }

      // The write landed. Everything below can still fail, and none of it may
      // report a save failure: telling the operator "Could not save" about a
      // row that IS saved invites them to save it twice.
      toast("Saved.", "success");
      onSaved?.();
      try {
        // Refetch rather than trust local state: sort_order is renumbered
        // server-side and a stale local order is worse than a round trip.
        await refresh();
      } catch (e: unknown) {
        toast(
          errorMessage(
            e,
            `Saved, but the ${label} list could not be reloaded. Refresh the page.`,
          ),
          "error",
        );
      } finally {
        setSavingKey(null);
      }
    },
    [rows, commit, validate, keyOf, refresh, label, toast, errorMessage, onSaved],
  );

  return {
    rows,
    loading,
    error,
    dirtyKeys,
    savingKey,
    rowErrors,
    update,
    save,
    revert,
    reload: refresh,
  };
}
