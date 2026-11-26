import { RpcError, rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";

/**
 * Panel copy for the five Super-staff System issue RPCs (l128 header §3).
 *
 * PT409 — an illegal move or a locked field — is not one the shared seam
 * classifies, so it is handled by code here. Its message names the reference
 * and the displayed status, then why: `<fn>: SI-… is in_progress; only an open
 * System issue can be started`.
 *
 * Refusals sharing 22023 are told apart by the message after the function
 * name, as everywhere. Anything not recognised is still shown, minus the
 * function name, rather than hidden.
 */

/** `close_system_issue: a close note is …` → `a close note is …`. */
const withoutFunction = (message: string) => message.replace(/^\w+: /, "");

const sentence = (s: string) => {
  const t = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

const REFUSALS: [RegExp, string][] = [
  [/^a resolution note is required/, "Enter a resolution note, at most 2000 characters."],
  [/^a close note is required/, "Enter a note, at most 2000 characters."],
  [/^a close reason is required/, "Choose a reason for closing."],
  [/^a valid email address is required/, "Enter a valid email address, at most 254 characters."],
  [/^a description is required/, "Enter what they said, at most 2000 characters."],
  [/^category is required/, "Choose the part of the website."],
];

function validationMessage(message: string): string {
  const text = withoutFunction(message);
  for (const [pattern, say] of REFUSALS) {
    if (pattern.test(text)) return say;
  }
  return sentence(text);
}

/** `SI-… is in_progress; only an open …` → `SI-… is in progress. Only an open ….` */
function moveMessage(message: string): string {
  const [where, why] = withoutFunction(message).split("; ");
  const status = where.replace(/ is in_progress$/, " is in progress");
  return why ? `${sentence(status)} ${sentence(why)}` : sentence(status);
}

export function systemIssueErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof RpcError)) return fallback;
  if (error.code === "PT409") return moveMessage(error.message);
  switch (error.kind) {
    case "validation":
      return validationMessage(error.message);
    // Worded as on Maintenance: a stale screen and a lost role must not read
    // as a network blip.
    case "not_found":
      return "Not found — this System issue no longer exists. Refresh the page.";
    case "permission":
      return "Not permitted — only an active Super Staff member can work System issues.";
    default:
      return rpcErrorMessage(error, fallback);
  }
}
