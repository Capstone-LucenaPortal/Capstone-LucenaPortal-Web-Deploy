"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that disables itself while its form's action is in flight,
 * so the responder can see the tap landed (ISO-9). This is the look, not the
 * guard — two taps in one frame beat the re-render. Pair it with
 * useSingleFlight on the form's action.
 */
export function SubmitButton({
  disabled,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      {...props}
    />
  );
}
