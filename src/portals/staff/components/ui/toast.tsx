import { cn } from "@/portals/staff/lib/utils";

interface ToastProps {
  message: string;
  variant?: "success" | "error" | "info" | "warning";
  className?: string;
}

function Toast({ message, variant = "info", className }: ToastProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
        variant === "success" && "bg-green-50 text-green-800 border border-green-200",
        variant === "error" && "bg-red-50 text-red-800 border border-red-200",
        variant === "info" && "bg-blue-50 text-blue-800 border border-blue-200",
        variant === "warning" && "bg-yellow-50 text-yellow-800 border border-yellow-200",
        className
      )}
    >
      {message}
    </div>
  );
}

export { Toast };
export type { ToastProps };
