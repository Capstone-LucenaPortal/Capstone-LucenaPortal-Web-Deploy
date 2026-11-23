# Email revamp: make every email look like it came from the City Government of Lucena

> **Status: Tier 1 done (2026-11-23).** All eight parts are on the `email-revamp` branches (DB and
> Web) and live on the Sandbox:
> - l116 applied
> - `send-email-queue` v24 deployed
> - `PORTAL_URL` and `EMAIL_FROM_NAME` set
> - the SMTP sender name and the three Auth templates pasted in the Dashboard
>
> Not done, by choice: the real-inbox check (Gmail, phone light and dark, Outlook, images blocked)
> and the six defense screenshots. Only the 53 deno tests and the SQL asserts have checked the
> output. That check and Tier 2 (the Yellow Card, staff and incident details boxes; the security
> notices) are follow-ups. Don't paste the prompt below again; it is kept as a record.

For the codev. Written 2026-11-22 from a grilling session with Joaquin. The adviser flagged at
the last consultation that our emails look bare, like a scam from an unready website, and asked
for it fixed before the defense (about 2026-11-22 to 27). Paste the prompt below into a fresh
session started in `Capstone-LucenaPortal-Web`. The spec it points at is the rest of this file.

```text
We're revamping every email the Lucena City Portal sends so it looks like an official City
Government of Lucena message, not a bare system email. The full spec, every decision already
made, and the copy for each email are in handoffs/done/email-revamp.md. Read all of it first.
The decisions in it are settled; don't reopen them. Ask me only what it and the code leave open.

Where things are
- Notification emails: ../Capstone-LucenaPortal-DB/supabase/functions/send-email-queue/ (the
  worker) and notify_citizen() (latest: migration l84). Read that function's README and the l64
  migration header first.
- Auth emails: Supabase Dashboard templates on the Sandbox. There are none in the repo yet.
- The receipt the citizen already sees: src/app/(citizen)/receipt/[reference]/page.tsx
  (DB layer l66, acknowledgement_receipts).
- Glossary: ../Capstone-LucenaPortal-DB/CONTEXT.md. Acknowledgement Receipt, Official Receipt
  and Payment Confirmation are three different things. Use those words exactly. Never write
  "receipt" on its own.
- Most of the work is in the DB repo; follow its CLAUDE.md. Web changes only the privacy notice.

How to work
- Work in the tier order in the spec. Tier 1 is what the panel sees, so it lands first.
- Test-first where there is code: the worker's render/escape/PDF functions get deno tests;
  the migration gets the contract and behaviour asserts (assert_lNN.sql and
  assert_lNN_behaviour.sql, the l111 precedent; the behaviour file's writes must not commit).
- Take the next free migration number after the newest one on the DB repo's origin/main.
- Commit each part when it is done and green, one commit per part, so QA can pin it.
- Branch off origin/main in each repo; never push to main. Joaquin merges.

Rules
- Sandbox (zqsqenfoszgcunvpqvvg) is the defense environment. Applying a migration, deploying the
  function, setting function secrets and pasting Dashboard templates there each need Joaquin's
  yes. Ask once the tests pass. Never touch production (uifixsfdujcezuxopnvz) for this task.
- Never run `supabase config push`. config.toml has only part of the remote auth settings, and
  pushing it would overwrite the rest (redirect URLs, site URL, the JWT hook).
- Test sends go only to our own qa.* inboxes and "TEST - JP -" records. Read-only SQL elsewhere,
  and never print names or contacts.
- The privacy notice is legal copy. Draft the change, then show it to Joaquin before committing.

When done, end with: the screenshots listed under "Done when", a "Proposed tickets" list (each
follow-up with why it matters, filed or only proposed), and the line "The email revamp is done."
```

---

## 1. What exists today

Two pipelines send email. Nothing else does: the other email links in the app are `mailto:` links.

| Pipeline | Emails | How it looks now |
|---|---|---|
| **Auth emails**: Supabase Auth (GoTrue) over Brevo SMTP | Confirm signup, Reset password, Invite | Supabase's stock templates, set in the Dashboard (e.g. "Confirm your signup / Follow this link…") |
| **Notification emails**: `notify_citizen()` writes a row, the `send-email-queue` worker sends it every 5 min through the Brevo API | 25 notices: booking, Yellow Card, Yellow Card deadlines (staff), incidents. Full list in §6 | Plain text. Subject = the in-app title, body = one sentence. No greeting, no branding, no link |

Things that make it look like a scam today:
- **Sender is `lucenaportal.dev@gmail.com`.** We have no domain yet, so it stays for now (see §2).
- No seal, no City Government name, no contact details, no "we will never ask for your password".
- Nothing is sent when a citizen files a booking, application or report, so the first email they
  get may be a decision.
- Payment emails read "Official receipt 12345." in a sentence, with no amounts laid out.

**Production sends no email at all** (no SMTP, and the l64 worker isn't applied there). The defense
demo runs on the Sandbox, where both pipelines work. This task targets the Sandbox only.

## 2. Decisions (settled; don't reopen)

| # | Decision |
|---|---|
| D1 | Both pipelines are in scope. |
| D2 | Notification emails become **HTML plus the existing plain text** (multipart). Every interpolated value is HTML-escaped. This reverses the deliberate plain-text-only choice in `delivery.ts`; update that comment and the README to say why. |
| D3 | English only, formal government register. |
| D4 | One shared layout for every email (§3). |
| D5 | Sender display name becomes **"City Government of Lucena – Lucena City Portal"** on both pipelines (`EMAIL_FROM_NAME` secret, and the SMTP sender name in Auth settings). The address stays `lucenaportal.dev@gmail.com` until a domain is bought; record that as a known limitation (§8). |
| D6 | Auth templates are versioned as files in the DB repo, `supabase/templates/*.html`, referenced from `config.toml` for the local stack. Pasting them into the Sandbox Dashboard is a written manual step. The files are the source; the Dashboard is a copy. |
| D7 | This hand-off is the task. No Jira or GitHub ticket unless Joaquin files one. |
| D8 | Two tiers: Tier 1 is the demo path, Tier 2 comes after (§9). |
| D9 | Two receipt-style emails: the **Acknowledgement Receipt email** (new, on every submission) and the **Payment Confirmation email** (a restyle of the three payment-accepted notices). The Payment Confirmation **quotes** the Official Receipt number and **never claims to be** the Official Receipt. |
| D10 | Demo environment is the Sandbox. Production email is out of scope. |
| D11 | A new `details jsonb` column on `notifications`, written at the same time as `title` and `body` (the l08 snapshot rule). The worker builds the HTML and PDF from it and never re-reads live tables for record content. `body` is unchanged and stays the in-app text and the plain-text part. |
| D12 | New event `receipt_issued`: when an Acknowledgement Receipt is issued, for all three services, the citizen gets an in-app notice and an email. |
| D13 | PDFs. The Acknowledgement Receipt email attaches `Acknowledgement-Receipt-<ref>.pdf`. Each Payment Confirmation email attaches `Payment-Confirmation-<ref>-<OR no>.pdf`, with the "not an Official Receipt" line printed on the PDF itself. No other email has an attachment. Built in the worker with `pdf-lib`, never stored. |
| D14 | The existing notice sentences are kept as they are. They are legally careful and they are the in-app text. The email wraps each one in a greeting, a details box, a "What happens next" line, one button and the footer. Subject = `<title> – <reference>`, unless the title already contains the reference. |
| D15 | Staff deadline notices use the same layout, with a "STAFF NOTICE" tag, and still never name the applicant. |
| D16 | Tier 2: switch on and brand the Supabase security notices (password changed, authenticator added or removed). |
| D17 | No domain yet. Keep the Gmail address, rename the sender, record the limitation. |

## 3. The shared layout

```
┌──────────────────────────────────────────────────────────┐  600px max, centred, page bg #F4F6F9
│▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀│  4px strip #FDB913
│  [SEAL]  REPUBLIC OF THE PHILIPPINES                      │  band #003DA5, white text
│   56px   CITY GOVERNMENT OF LUCENA                        │
│          Lucena City Portal                               │
├──────────────────────────────────────────────────────────┤
│  [ BOOKING · LUCENA CONVENTION CENTER ]   ← tag pill      │  white card, 32px padding
│                                                           │
│  Your booking is confirmed                ← heading = title│  22px bold #333333
│                                                           │
│  Good day, Maria,                                         │  15px #333333, Arial
│  BK-2026-000123 is confirmed. Official receipt …          │  ← existing body, unchanged
│                                                           │
│  ┌─ Details ───────────────────────────────────────────┐  │  bg #F4F6F9, 1px #DDDDDD
│  │ Reference No.     BK-2026-000123                    │  │  label 12px #666666 caps
│  │ Event             Santos–Reyes Wedding Reception    │  │  value 15px #333333
│  │ Venue             Main Hall                         │  │
│  │ Date and time     Sat, 12 Dec 2026, 9:00 AM         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  What happens next                                        │  14px bold
│  Pay the remaining balance in person at City Hall …       │
│                                                           │
│        ┌──────────────────────────┐                       │  bulletproof button,
│        │   View my booking        │                       │  #003DA5, white, 6px radius
│        └──────────────────────────┘                       │
│  Or open this link: https://…/dashboard                   │  12px #666666, link written out
├──────────────────────────────────────────────────────────┤
│  City Government of Lucena · Lucena City Portal           │  footer 12px #666666
│  Lucena City Government Complex, Diversion Road,          │
│  Brgy. Kanlurang Mayao, Lucena City, Quezon               │
│  Trunkline (042) … · Monday to Friday, 8:00 AM – 5:00 PM  │
│  helpdesk@lucena-city.gov.ph                              │
│  ─────────                                                │
│  🔒 The City Government of Lucena will never ask for your │  security line, on every email
│  password, one-time code or authenticator code by email,  │
│  text or phone call. Pay only through the steps shown in  │
│  the portal or in person at City Hall.                    │
│  This is an automated message from the Lucena City Portal.│
│  Replies to this address are not read. You received it   │
│  because you have an account on the Lucena City Portal.   │
└──────────────────────────────────────────────────────────┘
```

Build rules (these decide whether it renders in Gmail and Outlook):
- Table-based layout, **inline CSS only** (Gmail strips `<style>` from many clients), no flexbox or
  grid, no web fonts (Arial/Helvetica stack), max width 600px, works at 320px.
- Seal: an absolute public URL. On the Sandbox it is
  `https://zqsqenfoszgcunvpqvvg.supabase.co/storage/v1/object/public/site-content/agency/seal.png`.
  Build it from `SUPABASE_URL` and `site_info.seal_path`, never hardcode the project. Give it
  `alt="Seal of the City of Lucena"`, `width`/`height` attributes, and make sure the header still
  reads correctly with images blocked.
- Hidden preheader text = the first sentence of the body, so the inbox preview isn't "Republic of
  the Philippines".
- `<meta name="color-scheme" content="light">`. Check it in Gmail on a phone in dark mode.
- Footer values come from the same places the site uses: address and helpdesk from
  `src/portals/citizen/lib/contact-info.ts`; trunkline and office hours from `site_info` (the worker
  reads them once per run). The email and the site must never disagree.
- Brand tokens: blue `#003DA5`, yellow `#FDB913`, text `#333333`, muted `#666666`, error `#C62828`,
  success `#2E7D32` (from `src/app/(citizen)/globals.css`).

The Auth templates use the same layout as static HTML, with the footer values typed in. Keep one
`_layout.html` in `supabase/templates/` as the reference and copy it into each template, because
GoTrue templates can't include each other.

## 4. Auth emails (Supabase templates)

**Before editing any template, open the current one in the Sandbox Dashboard and keep its link
expression exactly** (`{{ .ConfirmationURL }}`, or a `token_hash` URL). The four `accept-invite`
pages and `/reset-password` depend on that link shape. Change the look and the words, not the
link. Check the real link expiry under Auth → Email (OTP expiry) and write that number where the
copy says `<expiry>`.

Greeting in every Auth template:
`{{ if .Data.full_name }}Good day, {{ .Data.full_name }},{{ else }}Good day,{{ end }}`

### A1. Invite (Super Staff creates an employee account), Tier 1
- **Subject:** Set up your Lucena City Portal employee account
- **Tag:** EMPLOYEE ACCOUNT · **Heading:** Your employee account is ready
- **Body:** The City Government of Lucena has created a Lucena City Portal employee account for
  {{ .Email }}. To start using it, set your password and turn on two-step sign-in with an
  authenticator app.
- **Button:** Set up my account
- **After the button:** This link can be used once and expires in `<expiry>`. If it has expired,
  ask your Super Staff administrator to send you a new sign-in link.
  If you were not expecting this email, you can ignore it. Nothing happens unless the link is used.

### A2. Reset password, Tier 1
This one template serves **both** the citizen "Forgot password?" and the Super Staff "Send a new
sign-in link" for employees, so the wording must fit both.
- **Subject:** Set a new password for your Lucena City Portal account
- **Tag:** ACCOUNT SECURITY · **Heading:** Set a new password
- **Body:** We received a request to set a new password for the Lucena City Portal account
  registered to {{ .Email }}. The request came from the portal's sign-in page, or from a City
  administrator re-sending your sign-in link.
- **Button:** Set a new password
- **After the button:** This link can be used once and expires in `<expiry>`. If you did not ask for
  this, you can ignore this email. Your password stays the same.

### A3. Confirm signup (citizen registration), Tier 1
The code says confirmation is ON in the Sandbox; the 2026-08-04 spec said OFF. Check the Dashboard
and brand the template either way.
- **Subject:** Confirm your email for the Lucena City Portal
- **Tag:** NEW ACCOUNT · **Heading:** Confirm your email address
- **Body:** Thank you for registering with the Lucena City Portal, the City Government of Lucena's
  online services portal. Confirm that {{ .Email }} is your email address to finish creating your
  account.
- **Button:** Confirm my email
- **After the button:** If you did not create an account, you can ignore this email. No account
  will be activated.

### A4. Security notices, Tier 2
Supabase's security notification emails, if the Dashboard offers them: password changed, MFA
factor enrolled, MFA factor unenrolled. Switch them on in the Sandbox and use the layout.
- **Password changed.** Subject: Your Lucena City Portal password was changed. Body: The password
  for {{ .Email }} was changed. If this was you, no action is needed. If it was not, reset your
  password from the sign-in page now and contact the helpdesk.
- **Authenticator added.** Subject: Two-step sign-in was turned on for your account. Body: An
  authenticator app was added to the account {{ .Email }}. If this was not you, contact your
  administrator or the helpdesk right away.
- **Authenticator removed.** Subject: An authenticator was removed from your account. Body: An
  authenticator app was removed from the account {{ .Email }}. You will be asked to set up a new
  one the next time you sign in. If you did not expect this, contact your administrator.
- Check: `authenticator.tsx` unenrolls a stale factor right before enrolling. If that sends a
  "removed" email just before "added", note it under Proposed tickets; don't redesign the flow.

## 5. Notification emails: the pipeline change

1. **`notifications.details jsonb`** (nullable). Written by `notify_citizen` when it writes the
   row, never updated afterwards. Dates are stored **pre-formatted in Manila time** as text (the
   `received_at_manila` precedent), so the worker never formats timezones. Money is stored
   pre-formatted as `"PHP 12,500.00"`.
2. **`notify_citizen` gets `p_details jsonb default null`.** Adding a parameter makes a new overload,
   and a 6-argument call would then be ambiguous, so **drop and recreate** it. Restate its comment and
   its "granted to nobody" ACL. Do the same for `notify_staff`, which delegates to it. Inside,
   merge in `recipient_name`: the citizen's first name, or the staff member's full name. Leave it
   out if neither is known, and the greeting falls back to "Good day,".
3. **Anonymisation.** Find what anonymising a citizen does to their `notifications` rows' `title` and
   `body`, and treat `details` the same way. l84 already withholds new emails to anonymised
   citizens; this covers rows written before.
4. **`claim_email_batch`** also returns `event_code`, `module_code`, `record_id` and `details`. The
   return type changes, so drop and recreate it, and update the worker.
5. **Worker** (`send-email-queue`):
   - `render.ts` (pure, unit-tested): `(notice) → { subject, html, text }`. Escape every value
     (`& < > " '`), including all of `details`. Build URLs with `encodeURIComponent`.
   - Brevo payload gains `htmlContent` (with `textContent` kept) and, for D13, `attachment:
     [{ name, content: <base64> }]`.
   - The plain-text part = greeting + existing body + the details as `Label: value` lines + "What
     happens next" + the link + the footer lines.
   - New function secret `PORTAL_URL` (the deployed Vercel origin), used for every button.
   - If building a PDF fails, send the email **without** the attachment and log it. The button
     still leads to the receipt page. Never fail or retry a notice over its PDF.
6. **Tests** (`deno test`):
   - A reason containing `<script>alert(1)</script>` and `Tom & "Jerry"` comes out escaped in the
     HTML and unchanged in the text.
   - The subject rule from D14.
   - Each PDF builder returns bytes starting with `%PDF`.
   - A notice with `details = null` still renders: old queued rows, generic box with just the
     reference.

   SQL asserts:
   - `receipt_issued` is written for each service with its details.
   - The payment notices carry the payment details.
   - `notify_citizen` has exactly one overload.

### PDFs (D13)
- `npm:pdf-lib`, A4. Use the built-in Helvetica. It has **no ₱ glyph**, so amounts are written
  "PHP 12,500.00", which the SQL already does.
- Embed the seal: fetch the PNG from the public URL built from **the `seal_path` on the receipt
  snapshot**, not the current `site_info` (seals are insert-only; an old receipt keeps its seal).
- **Acknowledgement Receipt PDF:** mirrors `/receipt/[reference]` exactly:
  1. seal, agency name, "ACKNOWLEDGEMENT RECEIPT"
  2. Reference Number
  3. Submission Received (service)
  4. Date and Time of Receipt + "Philippine Standard Time"
  5. Officer of Record (name, designation, unit). If `officer_is_placeholder`, use the page's
     "PENDING NOMINATION" wording instead.
  6. The page's footer sentence, citing Rule VII §2(c) of the IRR of RA 11032.

  **No processing deadline**, same as the page.
- **Payment Confirmation PDF:** same header with "PAYMENT CONFIRMATION", then the rows in §7.2,
  then the boxed line: *"This document confirms that your payment was accepted. It is not an
  Official Receipt. Official Receipt No. `<no>` is issued by the City Treasurer's Office and is
  the only valid proof of payment."*

## 6. Every notification email

**Core text = the existing title and body from the SQL, unchanged.** This section adds only the
tag, the details box, "What happens next" and the button. URLs are relative to `PORTAL_URL`.

**Booking block**, put in `details` by every booking notice:

| Label | Value |
|---|---|
| Reference No. | the booking reference |
| Event | `event_title` |
| Venue | the venue's display name from `booking_venues` |
| Date and time | `event_date` + `start_time`, e.g. "Saturday, 12 December 2026, 9:00 AM" |
| Duration | `<n> hours` |

**Money rows**, where the notice is about paying:

| Label | Value |
|---|---|
| Total fee | |
| Downpayment (`<pct>`%) | |
| Balance | |
| Pay by | `hold_expires_at` |

### 6.1 Booking (citizen). Tag: BOOKING · LUCENA CONVENTION CENTER

| event_code | Details box | What happens next | Button → URL | Tier |
|---|---|---|---|---|
| `receipt_issued` | see §7.1 | see §7.1 | View Acknowledgement Receipt → `/receipt/<ref>` | 1 |
| `quoted` | booking + money | Pay the downpayment from your dashboard before the date shown, or the slot is released. | Pay the downpayment → `/dashboard` | 1 |
| `document_verified` | booking (+ money if a downpayment is due) | Awaiting quote: City Hall will send you a quote before you pay. Otherwise: pay the downpayment before the date shown. | View my booking → `/dashboard` | 1 |
| `revision_requested` | booking + **Upload by** | Upload a corrected organisation document from your dashboard before the date shown. | Upload a corrected document → `/dashboard` | 1 |
| `document_rejected` | booking (+ money) | You can keep the booking at the commercial rate, or cancel it from your dashboard. | View my booking → `/dashboard` | 1 |
| `rejected_by_staff` | booking | For questions about this decision, contact City Hall using the details below. | View my bookings → `/dashboard` | 1 |
| `payment_verified` | **Payment Confirmation, §7.2** + PDF | Pay the remaining balance in person at City Hall before your event. | View my booking → `/dashboard` | 1 |
| `fully_paid` | **Payment Confirmation, §7.2** + PDF | Nothing further is due. See you at the Lucena Convention Center. | View my booking → `/dashboard` | 1 |
| `balance_settled` | **Payment Confirmation, §7.2** + PDF | Nothing further is due. See you at the Lucena Convention Center. | View my booking → `/dashboard` | 1 |
| `payment_rejected` (both kinds) | booking + **Amount submitted** + **Downpayment now due** | Submit the downpayment again from your dashboard. Money already sent is not returned through this system; contact City Hall about it. | Submit the downpayment again → `/dashboard` | 1 |
| `completed` | booking | Thank you for using the Lucena Convention Center. | View my bookings → `/dashboard` | 1 |
| `expired_unrevised`, `expired_unpaid` | booking | The slot has been released. You are welcome to book again. | Make a new booking → `/lcc` | 1 |

### 6.2 Yellow Card (citizen). Tag: YELLOW CARD

**Details:** Reference No., Decision, Decided on, Decided by, and Yellow Card No. when approved.

| event_code | What happens next | Button → URL | Tier |
|---|---|---|---|
| `receipt_issued` | see §7.1 | View Acknowledgement Receipt → `/receipt/<ref>` | 1 |
| `approved` | Your Yellow Card is ready. You can view it from the portal. | View my application → `/yellow-card/<record_id>` | 2 |
| `revision_requested` | Update your application and resubmit it from the portal. | Update my application → `/yellow-card/<record_id>` | 2 |
| `rejected` | You may submit a new application. | View my application → `/yellow-card/<record_id>` | 2 |

### 6.3 Yellow Card deadlines (staff). Tag: STAFF NOTICE · YELLOW CARD

**Details:** Reference No., Processing deadline (Manila), State (At Risk / Overdue).
**Never the applicant's name.**

| event_code | What happens next | Button → URL | Tier |
|---|---|---|---|
| `yc_at_risk` | Decide it before the deadline. | Open the Yellow Card queue → `/staff/yellow-card` | 2 |
| `yc_overdue` | Decide it now. | Open the Yellow Card queue → `/staff/yellow-card` | 2 |

### 6.4 Incident reports (citizen). Tag: INCIDENT REPORT

**Details:** Reference No., Department (where known), Status.

| event_code | What happens next | Button → URL | Tier |
|---|---|---|---|
| `receipt_issued` | see §7.1 | View Acknowledgement Receipt → `/receipt/<ref>` | 1 |
| `routed` | You will be told when a responder takes it. | View my report → `/dashboard` | 2 |
| `claimed` | You will be told when it is marked resolved. | View my report → `/dashboard` | 2 |
| `resolution_submitted`, `resolution_nudge` | Confirm the fix in the portal, or reopen the report. | Check the fix → `/dashboard` | 2 |
| `refused_invalid`, `refused_duplicate` | You may file a new report if the matter continues. | View my report → `/dashboard` | 2 |
| `auto_confirmed`, `expired_unverified` | Submit a new report if the problem is still there. | Report an incident → `/incident` | 2 |

Even before its Tier 2 row is done, every notice gets the shared layout in Tier 1, with a generic
details box showing just the reference.

## 7. The two receipt-style emails

### 7.1 Acknowledgement Receipt email (`receipt_issued`, new)

Write it from an **AFTER INSERT trigger on `acknowledgement_receipts`**, which calls
`notify_citizen(citizen_id, service, <submission id>, 'receipt_issued', …)`. Leave l66's
`issue_acknowledgement_receipt()` untouched.

The in-app notice uses the same title and body:

| Service | Title | Body |
|---|---|---|
| booking | We received your booking request | `<ref>` was received on `<received_at_manila>` (Philippine Standard Time). Your Acknowledgement Receipt is attached and is also in the portal. We will email you when your booking moves to its next step. |
| yellow_card | We received your Yellow Card application | `<ref>` was received on `<received_at_manila>` (Philippine Standard Time). Your Acknowledgement Receipt is attached and is also in the portal. We will email you when a decision is made. |
| incidents | We received your incident report | `<ref>` was received on `<received_at_manila>` (Philippine Standard Time). Your Acknowledgement Receipt is attached and is also in the portal. We will email you when it is sent to a department. |

The email body is laid out like the printed receipt, inside the shared layout. **No deadline
anywhere.**

```
              ACKNOWLEDGEMENT RECEIPT
   ┌──────────────────────────────────────────┐
   │ REFERENCE NUMBER                         │
   │ BK-2026-000123             (20px, blue)  │
   │ SUBMISSION RECEIVED   Lucena Convention  │
   │                       Center booking     │
   │ DATE AND TIME OF      22 November 2026,  │
   │ RECEIPT               4:05 PM (PST)      │
   │ OFFICER OF RECORD     Juan Dela Cruz     │
   │                       Administrative     │
   │                       Officer IV, City   │
   │                       Administrator's    │
   │                       Office             │
   └──────────────────────────────────────────┘
   This receipt acknowledges that the City Government of Lucena
   received the submission identified above … RA 11032 IRR Rule VII §2(c).
   [ View Acknowledgement Receipt ]    📎 Acknowledgement-Receipt-BK-2026-000123.pdf
```

`details` holds everything on the receipt row: reference, service label, `received_at_manila`,
officer name/designation/unit, `officer_is_placeholder`, `agency_name`, `seal_path`.

### 7.2 Payment Confirmation email (`payment_verified`, `fully_paid`, `balance_settled`)

Title and body stay as they are. The email shows:

```
              PAYMENT CONFIRMATION
   Booking  BK-2026-000123 · Santos–Reyes Wedding Reception
            Main Hall · Saturday, 12 December 2026, 9:00 AM
   ┌──────────────────────────────────────────────────────────┐
   │ Description        Method              OR No.     Amount │
   │ Downpayment (50%)  GCash, ref 1234567  0012345  PHP 6,250.00 │
   │                    accepted 22 Nov 2026                   │
   ├──────────────────────────────────────────────────────────┤
   │ Total fee                                  PHP 12,500.00 │
   │ Paid to date                                PHP 6,250.00 │
   │ Balance remaining                           PHP 6,250.00 │  ← or "Fully paid" in green
   └──────────────────────────────────────────────────────────┘
   ⓘ This email confirms that your payment was accepted. It is not an
     Official Receipt. Official Receipt No. 0012345 is issued by the
     City Treasurer's Office and is the only valid proof of payment.
   [ View my booking ]    📎 Payment-Confirmation-BK-2026-000123-0012345.pdf
```

- `details` = booking block + the payment row:
  - Description: kind and percent
  - Method: "GCash, ref `<gcash_reference>`" or "Cash at City Hall"
  - `official_receipt_no`
  - date accepted
  - amount

  plus total fee, paid to date and balance remaining.
- Snapshot these in `verify_payment` and `record_balance_payment` at the point they call
  `notify_citizen`. Take the latest definitions (l72 and l98) and change only the call.
- The word "receipt" alone never appears. The heading is "Payment Confirmation". Glossary:
  *Payment Confirmation*. Avoid: Receipt, E-receipt, Proof of payment, Invoice.

## 8. Sender and known limitation

- Set `EMAIL_FROM_NAME` = `City Government of Lucena – Lucena City Portal` (function secret) and
  the same sender name under Auth → SMTP Settings. Keep `EMAIL_FROM` as it is.
- Add a "Known limitation" line to `send-email-queue/README.md`: *Mail is sent from a Gmail address
  because the project has no domain yet. In production it would come from an official domain
  address with SPF, DKIM and DMARC set up in Brevo, which also keeps it out of spam folders.*
  That is also the answer if the panel asks.

## 9. Order of work

**Tier 1, before the defense (demo path):**
1. Sender name on both pipelines (§8).
2. Auth templates A1–A3 as files, pasted into the Sandbox Dashboard (§4).
3. Migration: `details`, `notify_citizen`/`notify_staff`, `claim_email_batch`, anonymisation,
   `receipt_issued` trigger, booking and payment details (§5, §7).
4. Worker: shared layout for every notice, the escaping, the plain-text part, `PORTAL_URL` (§3, §5).
5. Acknowledgement Receipt email + PDF (§7.1).
6. Payment Confirmation emails + PDF (§7.2).
7. Booking details boxes (§6.1).
8. Privacy notice (Web, §10).

**Tier 2, after:**
- Yellow Card, staff and incident details boxes (§6.2–6.4).
- Security notices (§4 A4).

## 10. Privacy notice (Web)

`src/portals/citizen/features/content/lib/privacy-notice.ts` says the email provider receives "the
address, the subject and the body, and no separate name field". After this task it also receives
the recipient's first name, the record details shown in the email, and a PDF copy of the
Acknowledgement Receipt or Payment Confirmation. Update §5 of the notice and that code comment to
say so, still naming the provider only as "a third-party email service provider". **Show Joaquin
the new wording before committing.**

## 11. Done when

- Every email in §4 (A1–A3) and §6.1, plus `receipt_issued` for all three services, has been sent on
  the Sandbox to a qa.* Gmail inbox and checked in:
  - Gmail web
  - Gmail on a phone (light and dark)
  - Outlook web

  With images blocked, the header still reads correctly.
- One screenshot each of: Invite, Reset password, Acknowledgement Receipt (with its PDF open),
  Payment Confirmation for a downpayment and for a balance (each with its PDF open), and one
  decision email. These go in the defense deck.
- None of them landed in spam. If one did, note it; that's the §8 limitation, not a blocker.
- `deno test` passes and both SQL assert files pass, and the existing l64/l83/l84 asserts still pass.
- No email claims to be an Official Receipt, says "receipt" on its own, or shows a processing
  deadline on an Acknowledgement Receipt.

## Out of scope

- Production email setup (SMTP, the l64 worker, its secrets).
- Buying a domain and SPF/DKIM/DMARC.
- Filipino copy.
- A `notification_templates` table. Copy stays in SQL, as `db-plan-04` decided.
- Recording "delivered" status (SCRUM-246).
- Emails for incident release, reject-claim or force-release, or for a citizen cancelling their own
  booking. Today none of those send a notice; list them under Proposed tickets if they matter.
