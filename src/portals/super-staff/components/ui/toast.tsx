import { cn } from "@/portals/super-staff/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";

const variantClasses: Record<ToastVariant, string> = {
  success: "bg-green-50 text-green-800 border-green-200",
  error: "bg-red-50 text-red-800 border-red-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
};

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  className?: string;
}

export function Toast({ message, variant = "info", className }: ToastProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg",
        variantClasses[variant],
        className,
      )}
    >
      {message}
    </div>
  );
}
