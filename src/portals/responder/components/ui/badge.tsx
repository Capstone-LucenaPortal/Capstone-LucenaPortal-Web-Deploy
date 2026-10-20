// Skeleton primitive — tone variants to be filled in from the design system.
import { cn } from "@/portals/responder/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn(className)}>{children}</span>;
}
