"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/portals/responder/components/ui/toast";
import { createClient } from "@/shared/supabase/client";
import type { DepartmentDuty } from "@/portals/responder/features/auth/lib/department-duty";
import type { ResponderUser } from "@/portals/responder/features/auth/types";

/**
 * Who is signed in, plus the duty flag, for the client half of the app.
 *
 * This replaces DutyProvider. The two were always one thing: the duty flag's
 * initial value came from the session, and every surface that renders the
 * switch also renders the responder's name or department. Two contexts over
 * one row could only ever drift.
 *
 * The duty flag is rendered in four places at once — header pill, drawer
 * footer, desktop rail footer, profile row — plus it gates the off-duty banner
 * on the pool. One context keeps them from drifting apart.
 */

interface SessionContextValue {
  responder: ResponderUser;
  /** null when the view returned no row — "no count", never "0 of 0". */
  duty: DepartmentDuty | null;
  onDuty: boolean;
  toggleDuty: () => void;
  /** True while a toggle is in flight, so the switch can refuse a double tap. */
  dutyPending: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  responder,
  duty,
  children,
}: {
  responder: ResponderUser;
  duty: DepartmentDuty | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [onDuty, setOnDuty] = useState(responder.on_duty);
  const [dutyPending, setDutyPending] = useState(false);

  const toggleDuty = useCallback(() => {
    if (dutyPending) return;

    const nextValue = !onDuty;

    // Move the switch first. This is tapped at the roadside on a slow
    // connection; waiting for the round trip before it moves reads as a dead
    // control, and the responder taps it again.
    setOnDuty(nextValue);
    setDutyPending(true);

    void (async () => {
      // set_my_on_duty (l51) takes no id and writes only auth.uid()'s row.
      // set_staff_on_duty (l47) is the Super Staff's version and refuses us.
      const supabase = createClient();

      const { error } = await supabase.rpc("set_my_on_duty", {
        p_on_duty: nextValue,
      });

      setDutyPending(false);

      if (error) {
        // Put it back. Leaving it flipped tells a responder they are out of the
        // department's headcount when they are not, or counted when they are
        // not -- and they plan their shift around it either way.
        setOnDuty(!nextValue);
        showToast("Could not update your duty status. Try again.");
        return;
      }

      // The department count was rendered on the server and is now one behind.
      router.refresh();
    })();
  }, [dutyPending, onDuty, router, showToast]);

  const value = useMemo(
    () => ({ responder, duty, onDuty, toggleDuty, dutyPending }),
    [responder, duty, onDuty, toggleDuty, dutyPending],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/**
 * The duty slice on its own.
 *
 * Kept as a separate export so the three surfaces that need only the flag —
 * DutySwitch, OffDutyBanner, NavRail — did not have to change beyond their
 * import path when DutyProvider became SessionProvider.
 */
export function useDuty(): Pick<
  SessionContextValue,
  "onDuty" | "toggleDuty" | "dutyPending"
> {
  const { onDuty, toggleDuty, dutyPending } = useSession();
  return { onDuty, toggleDuty, dutyPending };
}
