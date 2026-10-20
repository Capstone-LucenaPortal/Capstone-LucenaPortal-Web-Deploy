// Skeleton primitive — variants/sizes to be filled in from the design system.
import { cn } from "@/portals/responder/lib/utils";

export function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(className)} {...props} />;
}
