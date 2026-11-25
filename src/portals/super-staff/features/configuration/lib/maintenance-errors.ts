import { RpcError, rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";

/**
 * Card copy for the two maintenance RPCs (l125b header §3).
 *
 * Four refusals share 22023 and are told apart by the message after the
 * function name — the owner's ruling of 2026-11-25, recorded in the DB repo's
 * CLAUDE.md. So this matches on the message's wording, and anything it does
 * not recognise is still shown, minus the function name, rather than hidden.
 *
 * Two codes the shared seam does not classify are handled by code here:
 * 23P01, the clash with Bookings, whose message names the references Super
 * Staff must cancel or move first; and 23503, a Space the screen still lists
 * but the database no longer knows.
 */

/** `add_maintenance_period: the Atrium is …` → `the Atrium is …`. */
const withoutFunction = (message: string) => message.replace(/^\w+: /, "");

const sentence = (s: string) => {
  const t = s.charAt(0).toUpperCase() + s.slice(1);
  return t.endsWith(".") ? t : `${t}.`;
};

const DATE = "(\\d{4}-\\d{2}-\\d{2})";

const REFUSALS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [
    new RegExp(`^the first day ${DATE} is before today \\(${DATE}\\)$`),
    (m) => `The first day, ${m[1]}, is in the past. Today is ${m[2]}.`,
  ],
  [
    new RegExp(`^the last day ${DATE} is before today \\(${DATE}\\)$`),
    (m) => `The last day, ${m[1]}, is in the past. Today is ${m[2]}.`,
  ],
  [
    new RegExp(`^the last day ${DATE} is before the first day ${DATE}$`),
    (m) => `The last day, ${m[1]}, is before the first day, ${m[2]}.`,
  ],
  [
    new RegExp(`^the period ended on ${DATE}; extending it would add days before today \\(${DATE}\\)$`),
    (m) =>
      `This period ended on ${m[1]}. Extending it would close days that have already passed, so add a new period from today (${m[2]}) instead.`,
  ],
  [/^a reason is required/, () => "Enter a reason, at most 500 characters."],
];

function validationMessage(message: string): string {
  const text = withoutFunction(message);
  for (const [pattern, say] of REFUSALS) {
    const m = text.match(pattern);
    if (m) return say(m);
  }
  return sentence(text);
}

/** `the Atrium is booked during those days: BK-1, BK-2; cancel or move …` */
function clashMessage(message: string): string {
  const [booked, advice] = withoutFunction(message).split("; ");
  return advice ? `${sentence(booked)} ${sentence(advice)}` : sentence(booked);
}

export function maintenanceErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof RpcError)) return fallback;
  if (error.code === "23P01") return clashMessage(error.message);
  if (error.code === "23503") return "That Space no longer exists. Refresh the page.";
  switch (error.kind) {
    case "validation":
      return validationMessage(error.message);
    // Worded as on the calendar (calendar-errors): a stale screen and a lost
    // role must not read as a network blip.
    case "not_found":
      return "Not found — this Maintenance Period no longer exists. Refresh the page.";
    case "permission":
      return "Not permitted — only an active Super Staff member can change maintenance.";
    default:
      return rpcErrorMessage(error, fallback);
  }
}
