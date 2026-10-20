// src/portals/admin/components/ui/button.tsx
import { ButtonHTMLAttributes } from "react";
import { cn } from "@/portals/admin/lib/utils";

// Vocabulary matches the sibling Staff portal's Button exactly
// (src/portals/admin/components/ui/button.tsx there): primary | secondary | destructive |
// ghost. Staff's "danger" doesn't exist — its equivalent is "destructive",
// which is also the vocabulary Badge already converged on in Phase 5 (see
// src/portals/admin/components/ui/badge.tsx). There is no "success" variant here: no real
// call site in this app ever used it (verified against every <Button
// variant=...> usage), and Staff has no equivalent to invent one against.
type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-blue-900 text-white hover:bg-blue-800",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-gray-600 hover:text-gray-900",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-none px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
