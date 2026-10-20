import type { InputHTMLAttributes } from "react";
import { cn } from "@/portals/super-staff/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

/**
 * The value a number `Input` should show. `e.target.valueAsNumber` is NaN for a
 * cleared field, and React renders NaN as the literal string "NaN" — so every
 * `<Input type="number">` in the app funnels its value through this. It guards
 * DISPLAY only: refusing to save a NaN is the validators' job.
 */
export const numValue = (n: number) => (Number.isNaN(n) ? "" : n);

export function Input({ error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <input
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-10 w-full rounded-md border bg-white px-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-lucena-blue",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
