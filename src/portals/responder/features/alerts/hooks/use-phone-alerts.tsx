"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "@/portals/responder/components/ui/toast";
import {
  currentSubscription,
  isSignedUp,
  signUpDevice,
  turnOffDevice,
} from "@/portals/responder/features/alerts/lib/device";
import {
  alertSupport,
  readEnvironment,
  type AlertSupport,
} from "@/portals/responder/features/alerts/lib/support";

/**
 * Phone alerts on THIS device (ADR 0001), for the profile setting, the pool
 * banner and the drawer's duty line. One provider so the three never disagree.
 *
 * "loading" until mounted: the answer depends on the browser, and rendering a
 * guess on the server would hydrate into a different one.
 */
export type PhoneAlertStatus =
  | "loading"
  | "on"
  | "off"
  | Exclude<AlertSupport, "ready">;

interface PhoneAlertsValue {
  status: PhoneAlertStatus;
  /** True while a turn on/off is in flight, so a second tap is refused. */
  pending: boolean;
  /** Must be called from a tap: it may open the browser's permission prompt. */
  turnOn: () => Promise<void>;
  turnOff: () => Promise<void>;
  /** Re-reads the device, e.g. after a sign-out that failed half-way. */
  recheck: () => Promise<void>;
}

const PhoneAlertsContext = createContext<PhoneAlertsValue | null>(null);

async function readStatus(): Promise<PhoneAlertStatus> {
  const support = alertSupport(readEnvironment());
  if (support !== "ready") return support;
  try {
    const sub = await currentSubscription();
    return sub && (await isSignedUp(sub.endpoint)) ? "on" : "off";
  } catch {
    // Offline or a failed read: unknown, which is not "off". Stay as before
    // the answer arrived — no banner, no button, the drawer says the
    // headcount — rather than tell a signed-up responder their phone is silent.
    return "loading";
  }
}

export function PhoneAlertsProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<PhoneAlertStatus>("loading");
  const [pending, setPending] = useState(false);

  const recheck = useCallback(async () => {
    setStatus(await readStatus());
  }, []);

  useEffect(() => {
    let live = true;
    void readStatus().then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, []);

  // A ref, not the `pending` state: two taps inside one render both see the
  // state as false.
  const busy = useRef(false);

  const turnOn = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const result = await signUpDevice(readEnvironment().vapidKey);
    busy.current = false;
    setPending(false);

    if (result === "on") {
      setStatus("on");
      showToast("Phone alerts are on for this phone.");
    } else if (result === "blocked") {
      setStatus("blocked");
    } else if (result === "failed") {
      showToast("Could not turn on phone alerts. Try again.");
    }
    // "dismissed": the prompt was closed without an answer. Nothing changed,
    // and the button is still there to try again.
  }, [showToast]);

  const turnOff = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const ok = await turnOffDevice().catch(() => false);
    busy.current = false;
    setPending(false);

    if (ok) {
      setStatus("off");
      showToast("Phone alerts are off for this phone.");
    } else {
      showToast("Could not turn off phone alerts. Try again.");
    }
  }, [showToast]);

  const value = useMemo(
    () => ({ status, pending, turnOn, turnOff, recheck }),
    [status, pending, turnOn, turnOff, recheck],
  );

  return (
    <PhoneAlertsContext.Provider value={value}>
      {children}
    </PhoneAlertsContext.Provider>
  );
}

export function usePhoneAlerts(): PhoneAlertsValue {
  const ctx = useContext(PhoneAlertsContext);
  if (!ctx) {
    throw new Error("usePhoneAlerts must be used inside <PhoneAlertsProvider>");
  }
  return ctx;
}
