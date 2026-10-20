// Skeleton primitive — header/body/footer slots to be filled in.
import { cn } from "@/portals/responder/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn(className)}>{children}</div>;
}
