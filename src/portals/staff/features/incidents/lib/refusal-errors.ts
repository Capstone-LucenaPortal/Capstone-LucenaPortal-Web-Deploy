import type {
  ActionFailure,
  PostgrestErrorLike,
} from "@/portals/staff/lib/supabase/errors";

/**
 * Translation for `refuse_incident`'s errors, which `toActionFailure` cannot do.
 *
 * Every other staff RPC uses 22023 for one situation — a guard refused the
 * transition, almost always because the page is stale — and that is what the
 * shared translator assumes. refuse_incident raises 22023 for eight different
 * refusals, most of them about what the officer typed (an Original that is the
 * report itself, an Original that is itself a Duplicate), and PT404 for two
 * different missing rows. Rendered as "the page has been refreshed", the
 * officer's typed reference would be wiped by a revalidation and they would
 * never learn what was wrong with it.
 *
 * So this one reads the message as well as the code. The raw text is still
 * never rendered (decision 5 of the staff live-data record); it only picks
 * which sentence to show. Every fragment matched is the function's own fixed
 * wording, and the only caller text the RPC interpolates — the Original's
 * reference, after "no report " — is matched as a prefix, so a reference typed
 * to look like another message cannot pick the copy. Wording copied from
 * l85_refuse_incident.sql; ./refusal-errors.test.ts fails if it moves.
 */

const FALLBACK = "The refusal could not be saved. Please try again.";

const STALE_STATUS =
  "This report can no longer be refused — a responder may have claimed it, or a colleague may have closed it. The page has been refreshed.";

/** 22023 messages, by the fixed fragment that identifies each. */
const ARGUMENT_REFUSALS: [fragment: string, message: string][] = [
  [
    "cannot be its own Original",
    "A report cannot be a Duplicate of itself. Enter the reference number of the other report.",
  ],
  [
    "is itself a Duplicate",
    "That report is itself a Duplicate. Enter the reference number of the report it duplicates instead.",
  ],
  [
    "is already the Original of another report",
    "Other reports are already marked as Duplicates of this one, so it cannot become a Duplicate itself. Refuse it as Invalid, or leave it in the queue.",
  ],
  ["a reason is required", "Type a reason. It is sent to the citizen."],
  [
    "the limit is 500",
    "The reason is longer than 500 characters. Shorten it — it is never cut off, because it ends the citizen's notice.",
  ],
  [
    "needs the Original's reference number",
    "Enter the Original's reference number.",
  ],
];

export function toRefusalFailure(error: PostgrestErrorLike | null): ActionFailure {
  const text = error?.message ?? "";

  switch (error?.code) {
    case "42501":
      return {
        ok: false,
        message:
          "You do not have permission to refuse reports. Ask an administrator to check your module assignment.",
        stale: false,
      };

    case "PT404":
      if (text.startsWith("refuse_incident: no report ")) {
        return {
          ok: false,
          message:
            "No report has the reference number you entered. Check the Original's reference number and try again.",
          stale: false,
        };
      }
      return {
        ok: false,
        message: "This report no longer exists. The page has been refreshed.",
        stale: true,
      };

    case "22023": {
      if (text.includes("only an open or pooled report can be refused")) {
        return { ok: false, message: STALE_STATUS, stale: true };
      }
      const match = ARGUMENT_REFUSALS.find(([fragment]) => text.includes(fragment));
      return { ok: false, message: match ? match[1] : FALLBACK, stale: false };
    }

    default:
      return { ok: false, message: FALLBACK, stale: false };
  }
}
