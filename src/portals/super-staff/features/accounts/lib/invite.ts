import { createClient } from "@/shared/supabase/client";
import type { InvitePayload } from "./invite-payload";

export type InviteResult = {
  account: { id: string; full_name: string } & Record<string, unknown>;
  invited_email: string;
};

/**
 * Calls the staff-accounts Edge Function. functions.invoke attaches the
 * signed-in user's access token, which is the whole point: the function reads
 * my_staff_profile as the caller to check they are an active super_staff, and
 * create_staff_account_profile takes auth.uid() from the same token so the
 * audit row names a person instead of "System".
 */
export async function inviteAccount(
  payload: InvitePayload,
): Promise<InviteResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke<InviteResult>(
    "staff-accounts",
    { body: payload },
  );

  if (error) {
    // On a non-2xx, error.message is only "Edge Function returned a non-2xx
    // status code". The message worth showing is in the JSON body, which
    // supabase-js hands back as a Response on error.context.
    throw new Error(await readErrorMessage(error));
  }
  if (!data) throw new Error("The server returned an empty response.");
  return data;
}

export type ResendResult = { sent_to: string };

/**
 * Asks the staff-accounts function to email this employee a new sign-in link.
 * The link always goes to the account owner's address — an email cannot be
 * changed through the product (update_staff_account has no p_email), so a
 * Super Staff cannot redirect it to a mailbox they control.
 */
export async function resendSignInLink(id: string): Promise<ResendResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke<ResendResult>(
    "staff-accounts",
    { body: { action: "resend", id } },
  );

  if (error) throw new Error(await readErrorMessage(error));
  if (!data) throw new Error("The server returned an empty response.");
  return data;
}

export type ResetResult =
  { recorded: true } | { recorded: false; warning: string };

/**
 * Asks the staff-accounts function to remove this employee's authenticator,
 * so they set up a new one at their next sign-in (ADR 0009). The function
 * refuses the caller's own account and records the reset under their name.
 * A reset that worked but could not be recorded comes back as a 500 with
 * reset: true, as resend's does; that is not a failure, so it is returned
 * with the function's message rather than thrown.
 */
export async function resetAuthenticator(id: string): Promise<ResetResult> {
  const supabase = createClient();
  const { error } = await supabase.functions.invoke("staff-accounts", {
    body: { action: "reset-authenticator", id },
  });

  if (!error) return { recorded: true };
  const body = await readErrorBody(error);
  if (body?.reset === true) {
    return {
      recorded: false,
      warning:
        body.error || "The authenticator was reset but could not be recorded.",
    };
  }
  throw new Error(body?.error || GENERIC_ERROR);
}

// Deliberately not "could not create the account": several actions share this
// function now, and naming the wrong one sends the reader down a dead end.
const GENERIC_ERROR =
  "The staff-accounts function failed. Check its Edge Function logs.";

async function readErrorMessage(error: unknown): Promise<string> {
  return (await readErrorBody(error))?.error || GENERIC_ERROR;
}

// The function's JSON body on a non-2xx. reset is set when an authenticator
// reset went through but its audit row could not be written.
type ErrorBody = { error?: string; reset?: boolean };

async function readErrorBody(error: unknown): Promise<ErrorBody | null> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      return (await context.clone().json()) as ErrorBody;
    } catch {
      // Body was not JSON — fall through to the generic message.
    }
  }
  return null;
}
