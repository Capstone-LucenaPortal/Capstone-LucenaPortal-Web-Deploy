/** Domain types for the notifications slice. */

/**
 * A `my_notifications` row. The view self-scopes to `auth.uid()` — never add an
 * `.eq('citizen_id', …)` filter, and never read the `notifications` base table
 * (grants are revoked; it returns 403).
 *
 * What writes a row here: every booking-lifecycle event (quote issued, document
 * rejected, payment verified/rejected, balance settled, hold expiring), the
 * incident lifecycle sweeper's `resolution_nudge`, `auto_confirmed` and (since
 * DB layer `l78`) `expired_unverified` events, the incident decisions `routed`,
 * `claimed` and `resolution_submitted` (also `l78`), and — since `l63` — every
 * Yellow Card decision (approved, needs changes, not approved).
 *
 * ## The email channel (DB layer `l64`) — read before writing copy
 *
 * This panel is NOT the only channel any more, and it is still not safe to tell
 * a citizen they will be emailed. Both halves of that matter:
 *
 * - `notify_citizen` writes an `email` row beside every `in_app` row, and
 *   `sweep_send_email_queue()` (pg_cron, every 5 min) hands it to the
 *   `send-email-queue` Edge Function, which sends through Brevo.
 * - Whether it actually sends is per-project: `email_delivery_enabled()` is true
 *   only where the Vault holds both `email_worker_url` and
 *   `email_worker_secret`. **Verified true on the Sandbox project 2026-10-01.**
 * - TODO(backend): production's state is NOT verified here. Issue #7 reports it
 *   at layer 60 with `l41`–`l68` unpromoted, and production reads are blocked in
 *   this environment, so treat that as reported rather than checked. If it
 *   holds, production writes every email row `is_mocked = true,
 *   status = 'skipped'` — recorded, never sent, and never sent retroactively
 *   once the worker is configured.
 * - `status = 'sent'` means Brevo ACCEPTED the message, not that it arrived.
 *   Bounces are not recorded, so a notice to a dead address reads `sent`
 *   forever. Never write copy that promises delivery.
 * - Mail goes to `auth.users.email` — the sign-in address `claim_email_batch`
 *   joins on — NOT the `citizens.email` the profile screen shows. The portal
 *   cannot currently make them diverge (`update_citizen_profile` takes no
 *   `p_email`), but do not name the profile email as the destination.
 *
 * ## What that means for copy — two rules, not one
 *
 * One build serves both projects, so a sentence has to be true of a deployment
 * where no email goes out at all. That cuts two different ways:
 *
 * - **Service copy** — the "what happens next" screens on Yellow Card,
 *   incidents and bookings — names the inbox only, and does not mention email.
 * - **The Privacy Notice is the deliberate exception.** §2, §4 and §5 of
 *   `@/features/content/lib/privacy-notice` DO disclose the email channel and
 *   the delivery provider, because understating processing that a deployment
 *   actually performs is an RA 10173 defect in a way that disclosing an
 *   available recipient is not. The reasoning is in that file's header. Do not
 *   "fix" the notice to match the service copy.
 *
 * `channel` is selected below and deliberately never filtered on: since `l64`,
 * `my_notifications` filters `channel = 'in_app'` server-side, and it must stay
 * that way — without it every notice appears twice and the unread badge doubles.
 * The inbox *is* the in-app channel. SMS remains unimplemented.
 */
export interface MyNotification {
  id: string;
  /** `module_code` enum: 'yellow_card' | 'incidents' | 'booking' | 'platform'.
   * Note the plural `incidents` — it does not match the singular used in RPC
   * names or in `my_incidents`' own copy. Used to deep-link `record_id` to the
   * right dashboard card; `platform` notifications carry no record. */
  module_code: string;
  record_id: string | null;
  event_code: string;
  channel: string;
  status: string;
  title: string;
  body: string | null;
  created_at: string;
  sent_at: string | null;
  /** Null until `mark_notification_read` runs. Drives the unread badge. */
  read_at: string | null;
}
