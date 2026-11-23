"use client";

import { Eye, EyeOff } from "lucide-react";

/**
 * The show/hide eye every password field in every Portal uses, so they all
 * look and behave the same. Place it inside a `relative` wrapper around the
 * input and give the input right padding (`pr-10`) so text never runs under it.
 *
 * The open eye means "show"; once the password is visible it becomes the
 * crossed-out eye, meaning "hide".
 */
export function PasswordVisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    // type="button": inside a <form> a bare <button> submits it.
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-gray-500 hover:text-gray-700"
    >
      {visible ? (
        <EyeOff size={18} aria-hidden="true" />
      ) : (
        <Eye size={18} aria-hidden="true" />
      )}
    </button>
  );
}
