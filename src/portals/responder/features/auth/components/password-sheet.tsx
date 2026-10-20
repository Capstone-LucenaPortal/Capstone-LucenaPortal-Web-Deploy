"use client";

import { useId, useState } from "react";
import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";
import { cn } from "@/portals/responder/lib/utils";

const MIN_LENGTH = 8;

// Deliberately does not claim to sign you out of every other device: whether
// GoTrue revokes other refresh tokens on a password change is a project
// setting nobody here has checked, and the sheet must not assert it.
const DESCRIPTION =
  "You'll need your current password. Your department and claims are untouched.";

/**
 * Password reset. The sheet stays presentational: it owns the fields and the
 * validation, and the caller owns the network calls.
 */
export function PasswordSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Performs the change. Returns null on success, or a message to show the
   * user. The sheet cannot do this itself: Supabase's updateUser authorises on
   * the session alone and never checks the current password, so verifying it
   * takes a second call that belongs with the rest of the page's IO.
   */
  onSubmit: (current: string, next: string) => Promise<string | null>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const longEnough = next.length >= MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current.length > 0 && longEnough && confirm === next;

  const close = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setServerError(null);
    setBusy(false);
    onClose();
  };

  async function handleUpdate() {
    setServerError(null);
    setBusy(true);

    const message = await onSubmit(current, next);

    if (message) {
      setServerError(message);
      setBusy(false);
      return;
    }

    close();
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Reset your password"
      description={DESCRIPTION}
    >
      <div className="mt-4 flex flex-col gap-3">
        <Field
          label="Current password"
          value={current}
          onChange={setCurrent}
          // Not bullets: a dot placeholder is indistinguishable from a filled
          // password field, so an empty box reads as one you already typed in.
          placeholder="The one you use now"
        />

        <Field
          label="New password"
          value={next}
          onChange={setNext}
          // The hint below owns the length rule and never leaves the layout,
          // so repeating it here would just say the same thing twice.
          placeholder="Type a new one"
          invalid={next.length > 0 && !longEnough}
          hint={
            next.length === 0
              ? `At least ${MIN_LENGTH} characters`
              : longEnough
                ? "Long enough."
                : `At least ${MIN_LENGTH} characters`
          }
          hintTone={
            next.length === 0
              ? "muted"
              : longEnough
                ? "positive"
                : "negative"
          }
        />

        <Field
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Type it again"
          invalid={mismatch}
          hint={mismatch ? "Those two don't match yet." : undefined}
          hintTone="negative"
        />
      </div>

      {serverError && (
        <p role="alert" className="mt-3 text-[12.5px] text-red-600">
          {serverError}
        </p>
      )}

      <div className="mt-4.5 flex gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={close}
          className="h-12 flex-1 rounded-md border border-gray-300 bg-white text-[15px] font-semibold text-gray-900 hover:bg-gray-50 disabled:text-gray-400"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => void handleUpdate()}
          className="h-12 flex-1 rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy ? "Updating…" : "Update"}
        </button>
      </div>
    </BottomSheet>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  invalid = false,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  hint?: string;
  hintTone?: "muted" | "positive" | "negative";
}) {
  const inputId = useId();
  const hintId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-[13px] font-medium text-gray-900"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="password"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        // The hint describes the field; it must not become part of its name.
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 rounded-md border px-3 text-sm text-gray-900",
          invalid ? "border-red-500" : "border-gray-300",
        )}
      />
      {hint && (
        <span
          id={hintId}
          className={cn(
            "text-[11.5px]",
            hintTone === "negative"
              ? "text-red-600"
              : hintTone === "positive"
                ? "text-green-700"
                : "text-gray-500",
          )}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
