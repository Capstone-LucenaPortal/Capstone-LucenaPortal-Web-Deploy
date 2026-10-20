/** Enforced by a check constraint AND re-validated inside
 *  `mark_contact_message_handled`, which raises 22023 for anything else. */
export type ContactStatus = "new" | "read" | "archived";

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: ContactStatus;
  /** The RPC stamps handled_by/handled_at on EVERY call, including a revert to
   *  "new". This is "last touched by", not "resolved by" — label it that way. */
  handledByName: string | null;
  handledAt: string | null;
  createdAt: string;
};
