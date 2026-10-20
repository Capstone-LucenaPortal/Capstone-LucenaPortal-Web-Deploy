import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/portals/super-staff/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function Textarea({ error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
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
