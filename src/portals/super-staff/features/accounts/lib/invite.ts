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

async function readErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // Body was not JSON — fall through to the generic message.
    }
  }
  // Deliberately not "could not create the account": two actions share this
  // function now, and naming the wrong one sends the reader down a dead end.
  return "The staff-accounts function failed. Check its Edge Function logs.";
}
