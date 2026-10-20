import type { LucideIcon } from "lucide-react";
import { cn } from "@/portals/responder/lib/utils";

type EmptyTone = "positive" | "neutral" | "info";

const TONES: Record<EmptyTone, string> = {
  positive: "bg-green-100 text-green-800",
  neutral: "bg-gray-100 text-gray-500",
  info: "bg-blue-50 text-lucena-blue",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: EmptyTone;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-8 py-14 text-center", className)}>
      <div
        className={cn(
          "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
          TONES[tone],
        )}
      >
        <Icon size={30} strokeWidth={2} aria-hidden />
      </div>
      <p className="text-[17px] font-semibold text-gray-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] text-pretty text-gray-500">
        {description}
      </p>
      {action && <div className="mt-4.5">{action}</div>}
    </div>
  );
}
