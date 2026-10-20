"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The load-a-record-into-a-form lifecycle the three content editors share.
 *
 * Announcement, event and place editors each carried this verbatim: the same
 * `isEdit` derivation, the same six pieces of state, and the same effect with
 * the same `active` guard against a resolve that lands after unmount. They
 * differ only in WHICH loader and WHICH row-to-form map they call, so those
 * come in as functions. There is no flag here that exists to switch behaviour
 * per caller — where the editors genuinely diverge (category lists, publish
 * confirmations, save handlers, the shape of `errors`) they keep their own
 * code, because folding those in would need exactly such a flag.
 *
 * ⚠️ `load`, `toFormValue` and `onLoaded` are held in a ref and deliberately
 * NOT in the effect's dependency list. They are module-level or `useCallback`
 * functions at every call site today; reading them through a ref means an
 * inline lambda cannot turn this into a re-fetch loop.
 */
export function useEditableRecord<TRecord extends { id: string }, TValue>(options: {
  /** Undefined on a "new" route — nothing is loaded and the form starts empty. */
  id: string | undefined;
  load: (id: string) => Promise<TRecord | null>;
  toFormValue: (record: TRecord) => TValue;
  empty: TValue;
  /** Runs after a successful load, e.g. to fetch the record's edit history. */
  onLoaded?: (record: TRecord) => void;
}) {
  const { id, empty } = options;
  const isEdit = id !== undefined;

  const [record, setRecord] = useState<TRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [value, setValue] = useState<TValue>(empty);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);

  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    if (!isEdit) return;
    let active = true;

    latest.current
      .load(id)
      .then((found) => {
        if (!active) return;
        if (!found) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRecord(found);
        setValue(latest.current.toFormValue(found));
        setLoading(false);
        latest.current.onLoaded?.(found);
      })
      .catch(() => {
        // A failed read is shown as not-found rather than as a crash: the
        // super_* views return zero rows to anyone the gate refuses, so
        // "missing" and "not yours" are the same answer to this screen.
        if (!active) return;
        setNotFound(true);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isEdit]);

  /** Patch one or more form fields, leaving the rest alone. */
  const set = (patch: Partial<TValue>) =>
    setValue((v) => ({ ...v, ...patch }));

  return {
    isEdit,
    record,
    setRecord,
    notFound,
    value,
    setValue,
    set,
    loading,
    setLoading,
    busy,
    setBusy,
  };
}
