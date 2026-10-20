"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import {
  usePhoneAlerts,
  type PhoneAlertStatus,
} from "@/portals/responder/features/alerts/hooks/use-phone-alerts";

/**
 * The opt-in surfaces for Phone alerts (ADR 0001, decision 5): a setting on the
 * profile under the duty switch, and a banner on the pool while this device is
 * not signed up. Never an automatic prompt. UI copy never says "push"
 * (CONTEXT.md).
 */

const IOS_STEPS = [
  "Tap Share in Safari.",
  "Tap Add to Home Screen.",
  "Open the Portal from your Home Screen and come back here.",
];

export function PhoneAlertsSetting({ onDuty }: { onDuty: boolean }) {
  const { status, pending, turnOn, turnOff } = usePhoneAlerts();

  if (status === "loading") return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-[12.5px] text-pretty text-gray-500">
        {settingCopy(status, onDuty)}
      </p>

      {status === "needs-install" && (
        <ol className="mt-1.5 list-decimal pl-5 text-[12.5px] text-gray-500">
          {IOS_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {status === "off" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void turnOn()}
          className="mt-2.5 flex h-10 items-center gap-1.5 rounded-md bg-lucena-blue px-3.5 text-[13.5px] font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
        >
          <BellRing size={15} aria-hidden />
          {pending ? "Turning on…" : "Turn on phone alerts"}
        </button>
      )}

      {status === "on" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void turnOff()}
          className="mt-2.5 h-9 rounded-md border border-gray-300 bg-white px-3 text-[12.5px] font-semibold text-gray-900 hover:bg-gray-50 disabled:text-gray-400"
        >
          {pending ? "Turning off…" : "Turn off phone alerts"}
        </button>
      )}
    </div>
  );
}

function settingCopy(status: Exclude<PhoneAlertStatus, "loading">, onDuty: boolean) {
  switch (status) {
    case "on":
      return onDuty
        ? "Phone alerts are on for this phone. New pool work rings it while you're on duty."
        : "Phone alerts are on for this phone, and paused while you're off duty.";
    case "off":
      return "Get a phone alert when new work enters your pool while you're on duty.";
    case "needs-install":
      return "On iPhone, phone alerts work only from the Home Screen:";
    case "blocked":
      return "Phone alerts are blocked for this site. Allow notifications for it in your browser settings, then reload.";
    case "unsupported":
      return "This browser can't show phone alerts. New pool work shows only in your Inbox.";
    case "unavailable":
      return "Phone alerts are coming. Until then, new pool work shows only in your Inbox, so open the app to check.";
  }
}

/** Shown on the pool only while this device could be signed up but is not. */
export function PhoneAlertsBanner() {
  const { status, pending, turnOn } = usePhoneAlerts();

  if (status !== "off" && status !== "needs-install") return null;

  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-blue-100 bg-blue-50 px-4 py-2.5 text-blue-800">
      <BellRing size={17} className="shrink-0" aria-hidden />
      <p className="flex-1 text-[13px] text-pretty">
        {status === "off"
          ? "Get a phone alert when new work lands here."
          : "On iPhone, phone alerts need the Portal on your Home Screen."}
      </p>
      {status === "off" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void turnOn()}
          className="h-8 shrink-0 rounded-md bg-lucena-blue px-3 text-[12.5px] font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
        >
          Turn on
        </button>
      ) : (
        <Link
          href="/responder/profile"
          className="shrink-0 text-[12.5px] font-semibold text-lucena-blue underline"
        >
          How
        </Link>
      )}
    </div>
  );
}

/**
 * The drawer's line under "On duty" / "Off duty". Duty is the headcount; the
 * alert half is this device. Until the device is known it says only the
 * headcount, as it did before alerts existed.
 */
export function dutyLine(onDuty: boolean, status: PhoneAlertStatus): string {
  if (!onDuty) return status === "on" ? "Not counted · alerts paused" : "Not counted";
  if (status === "loading" || status === "unavailable") return "Counted in shift";
  return status === "on" ? "Counted · alerts on" : "Counted · alerts off";
}
