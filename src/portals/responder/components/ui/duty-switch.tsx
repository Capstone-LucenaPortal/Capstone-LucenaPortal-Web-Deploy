"use client";

import { cn } from "@/portals/responder/lib/utils";
import { useDuty } from "@/portals/responder/features/auth/hooks/use-session";

type SwitchSize = "sm" | "md" | "lg";

const SIZES: Record<
  SwitchSize,
  { track: string; knob: string; onLeft: string; offLeft: string }
> = {
  sm: { track: "w-11 h-6.5", knob: "w-5 h-5", onLeft: "left-[21px]", offLeft: "left-[3px]" },
  md: { track: "w-12 h-7", knob: "w-5.5 h-5.5", onLeft: "left-[23px]", offLeft: "left-[3px]" },
  lg: { track: "w-13 h-7.5", knob: "w-6 h-6", onLeft: "left-[25px]", offLeft: "left-[3px]" },
};

/**
 * The on-duty switch. Rendered in the drawer footer, the desktop rail footer,
 * and the profile page — all three read the same context, so flipping any one
 * of them moves the others.
 */
export function DutySwitch({
  size = "md",
  onDark = false,
  labelledBy,
}: {
  size?: SwitchSize;
  /** Sits on the blue nav; the off state needs a lighter track to stay visible. */
  onDark?: boolean;
  labelledBy?: string;
}) {
  const { onDuty, toggleDuty, dutyPending } = useDuty();
  const s = SIZES[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={onDuty}
      aria-label={labelledBy ? undefined : "On duty"}
      aria-labelledby={labelledBy}
      onClick={toggleDuty}
      // Task 9 makes the toggle a network call. A switch that accepts a second
      // tap mid-flight sends two writes whose order is not guaranteed, and the
      // responder ends up in the state they did not choose.
      disabled={dutyPending}
      className={cn(
        "relative shrink-0 rounded-full p-0 transition-colors",
        s.track,
        onDuty
          ? "bg-lucena-yellow"
          : onDark
            ? "bg-white/25"
            : "bg-gray-300",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] rounded-full bg-white shadow transition-[left] duration-150",
          s.knob,
          onDuty ? s.onLeft : s.offLeft,
        )}
      />
    </button>
  );
}
