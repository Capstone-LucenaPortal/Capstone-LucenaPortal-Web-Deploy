import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/portals/staff/lib/utils";

interface BackLinkProps {
  href: string;
  label: string;
  className?: string;
}

export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-lucena-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue focus-visible:ring-offset-2 rounded-sm",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
