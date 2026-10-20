// Skeleton primitive — label/error/hint wiring to be filled in.
import { cn } from "@/portals/responder/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(className)} {...props} />;
}
