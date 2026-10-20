# Citizen Portal (src/portals/citizen)

The repo-wide agent setup — issue trackers, triage labels, domain docs — is in
the root `CLAUDE.md`. Citizen's glossary is `CONTEXT.md` beside this file.

## What this is

The **citizen-facing** Portal of the Lucena City Portal capstone (Next.js 16 App Router,
React 19, TypeScript strict, Tailwind v4). Residents apply for a Yellow Card, report
incidents, book the Lucena Convention Center (LCC), and browse city content.

Until the 2026-10 merge (SCRUM-209, MRG-07) it was its own repo, Capstone-LucenaPortal-EndUser.
It now lives in this one app with the four staff-side Portals and **owns the root**: every
citizen address is where it always was (`/`, `/dashboard`, `/yellow-card`, …), while the
staff-side Portals sit under `/staff`, `/super-staff`, `/responder` and `/admin` (workspace
ADR 0005). It keeps its own root layout, font, stylesheet and CSP, and gets no server check — its
protected routes are gated client-side, as before (ADR 0006). Its session lives in its own
session-scoped cookie, `sb-<ref>-citizen-auth-token` (PKCE, its own client in
`lib/supabase/client.ts`; ADR 0007), independent of the staff-side cookie session, which the
request guard alone reads (ADR 0004). The idle clock, idle notice and recovery flag stay in
localStorage.

Where things are:

- Routes: `src/app/(citizen)/` — its root layout, `globals.css`, `error`, `loading`, `not-found`
  and `sitemap.ts`. `src/app/manifest.ts` (Next serves the manifest from the app root only),
  `src/app/global-error.tsx` (the app's only global error page) and `src/app/global-not-found.tsx`
  (an unmatched URL anywhere gets Citizen's 404) are Citizen's too.
- Code: this folder — `components/`, `features/`, `lib/`, `scripts/`, `docs/`.
- Security headers and CSP: `lib/security-headers.ts`, applied by the root `next.config.ts` to
  every path outside the staff-side prefixes.
- Database types: the app's one shared `src/shared/supabase/types.ts`.

The sibling repos under `C:\Users\jmper\Documents\Capstone-LucenaPortal\` still include
`Capstone-LucenaPortal-DB` (the deployed SQL — the authority on schema) and
`Central-System-Documents` (design/decision docs, `rpc-reference.md`). See **Working with the
database** below before touching anything DB-side.

## Commands

Run from the repo root; the scripts are the whole app's.

```bash
npm run dev            # dev server on :3000
npm run build          # production build
npm run test           # vitest run (every Portal's *.test.ts)

npx vitest run src/portals/citizen "src/app/(citizen)"   # Citizen's tests only
npx vitest run src/portals/citizen/features/booking/lib/booking.test.ts   # one test file
npx vitest run -t "mock mode"                             # one test by name
npm run lint           # eslint
npx tsc --noEmit       # typecheck (also `npm run type-check`)
```

Env: copy the root `.env.example`. **Leaving `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` unset is a supported
mode** — the whole app falls back to a localStorage mock (see below), which is also how the test
suite runs. To run against a real backend, fill them from the **Sandbox** project (below).

## Working with the database

Anything involving the schema — reading it, querying it, checking an RPC signature, verifying a
`TODO(backend)` assumption — goes through the **`supabase-lucena` MCP server** (configured in
`../.mcp.json`, serving both projects; the `project_id` argument picks which). Do not infer schema
from this Portal's hand-rolled row interfaces or from `src/shared/supabase/types.ts` — both are
copies that drift.

| | |
|---|---|
| **Default — use this** | **`zqsqenfoszgcunvpqvvg` — "Lucena City Portal DB Sandbox"** (`ap-southeast-1`, PG 17). Queries, experiments, test data, and portal development all belong here. Assume it unless told otherwise. |
| Production | `uifixsfdujcezuxopnvz` — "Lucena City Portal Database". Touch only when the task explicitly says production. If a request is ambiguous about which project it means, **ask rather than guessing**. |

Point local `.env.local` at the sandbox (`get_project_url` / `get_publishable_keys`); never point a
production build at it — its data is disposable.

The sandbox is a full replica built purely by **replaying the committed migration set**, which is
the entire source of its value. Business rows and storage objects are free to churn, but **do not
hand-patch its schema** — schema changes are authored as migration files in
`../Capstone-LucenaPortal-DB` and applied from there, never improvised from this repo. If a frontend
need requires a schema change, that's a change in the DB repo, documented first.

Read `../Capstone-LucenaPortal-DB/CLAUDE.md` before any DB work — it covers migration ordering,
the revoke sweep, and the traps. Two more worth knowing here, because they surface as frontend
symptoms: `supabase.from('<base_table>')` returns **403** (reads must go through a view, and you
must never add `.eq('user_id', …)` — the view already self-scopes), and a failed staff/role gate
returns **HTTP 200 with `[]`**, indistinguishable from "no rows exist".

Other references: `../Capstone-LucenaPortal-DB/docs/what-not-to-do.md` (read first — most "obvious
fixes" there are defects), `../docs/rpc-reference.md` (RPC contracts — read before calling
anything), `../Capstone-LucenaPortal-DB/README.md` (current state, verified behaviour, known gaps).

After any migration lands, regenerate the app's `src/shared/supabase/types.ts` with
`generate_typescript_types` against the same project.

## Architecture

### The layout

Every Portal in the app shares one shape. `@/*` resolves to `src/*`, so Citizen's code is
imported as `@/portals/citizen/...`. Paths below are relative to `src/portals/citizen/` unless
they start with `src/`.

```
src/app/(citizen)/           App Router routes ONLY — no components, no helpers
components/{layout,ui}/      Cross-feature presentational components
features/<slice>/            auth · booking · content · dashboard · incidents ·
  components/ hooks/ lib/    notifications · profile · yellow-card
  types.ts                   the slice's domain types
lib/                         supabase/ (client, catalogs),
                             storage/ (file-validation, image-sanitizer),
                             mock/ (dev-only localStorage store),
                             contact-info.ts, validation.ts
```

A component or helper used by exactly one slice belongs in that slice. Promote it to
`components/` or `lib/` only once a second slice needs it.

### The env-gated data seam

Every backend feature follows one pattern. Do not scatter `supabase-js` calls into components.

```
src/app/(citizen)/*/page.tsx  ──►  features/<slice>/lib/<module>.ts  ──►  lib/supabase/client.ts ──► Supabase
                              │                                          │
                              │  pure map…ToParams() (unit-tested)        └─ returns null when env unset
                              ├─ live:  client.rpc(...) / client.from('my_*').select()
                              └─ mock:  lib/mock/request-store.ts (localStorage, dev only)
```

`getSupabaseClient()` returns `null` when env is unconfigured. Every method branches on that
null: the live path hits Supabase, the mock path fabricates a reference number and writes a
`StoredRequest` to localStorage. **Read-only methods return `[]`/`null` in mock mode rather than
faking rows.** When adding a service method, keep both branches.

Each feature lib also carries a `translate*Error(message)` that maps raw Postgres/RPC error text to
citizen-facing copy, thrown as a module-specific `Error` subclass (`BookingSubmitError`,
`YellowCardSubmitError`, `IncidentSubmitError`, `AuthError`). Pages catch the subclass and fall
back to a generic message for anything else.

### Backend contract (decided in `docs/superpowers/specs/2026-07-31-supabase-backend-wiring-design.md`)

- **The database is the authority.** Where the frontend and DB disagree, the frontend changes.
- **Reads through `my_*` / `public_*` views; writes through `security definer` RPCs.** RLS is retired
  and base-table grants are revoked — a client physically cannot `.from('incidents').insert(...)`.
  Caller identity always comes from `auth.uid()` inside the function, never a parameter.
- **Triggers own the state machine.** Reference numbers (`INC-`/`YC-`/`BK-`/`LC-`), SLA clocks,
  fees, `hold_expires_at`, `verification_token`, occupancy ranges are all trigger-set. Never generate
  them client-side (mock-mode fakes are the sole exception).
- RPC params use literal `p_*` names; all `p_*_code` values come from the `public_*` catalogs read by
  `lib/supabase/catalogs.ts` — never hardcoded frontend strings.
  `features/incidents/lib/incidents.ts` still has hardcoded `INCIDENT_TYPE_CODES` / `BARANGAY_CODES`
  tables marked `TODO(backend)`; those are the known exception, to be deleted when the dropdowns
  move to catalogs.

### File uploads — always three steps

`request_*_document_upload` RPC (reserves a row, returns `{row_id, bucket, storage_path}`) →
`client.storage.from(bucket).upload(path, file)` → `confirm_upload` RPC with size/mime.
See `features/yellow-card/lib/yellow-card.ts` (`uploadVoterIdDocument`) and
`features/booking/lib/booking.ts` (`uploadBookingDocument`).

### Auth & profile completion

`features/auth/lib/auth.ts` wraps Supabase Auth; `features/auth/hooks/use-auth.tsx` holds the
session and calls `ensureCitizenProfile()` on every auth change. Signup is two-phase: `auth.signUp` stashes all
profile fields in `user_metadata` (via `buildSignupMetadata`), then `create_citizen_profile` runs
once a session exists. `ensureCitizenProfile` replays that metadata
(`tryBuildProfileParamsFromMetadata`) for users who arrive with a session but no `citizens` row;
when it can't recover enough it returns `'incomplete'` and `/complete-signup` collects the fields
manually. All three paths converge on `mapSignupToProfileParams`.

`features/auth/components/protected-route.tsx` gates authenticated pages — it opens the auth modal
and redirects to `/`.

### LCC booking wizard

`features/booking/components/lcc-flow.tsx` (About/Book tabs) → `lcc-booking.tsx` is the
orchestrator holding `BookingFormData` and a `WizardStage` of
`1 | 2 | 3 | 4 | 'org-document' | 'tier-review' | 'payment' | 'quote' | 'verification'`.
Steps 1–4 are the numbered form; after `submitBooking` the stage branches on the **server's**
returned status (`nextStageAfterSubmit`): `pending` → organisation-document upload (a discounted
booking), `awaiting_quote` → quote screen, else payment. The upload leads to the Tier Review wait
(no payment until City Hall decides the Tier Claim); the skip calls `give_up_tier_claim` and routes
on the status it returns (SCRUM-198, DB l77). Step components in
`features/booking/components/steps/` are presentational and receive `{ bookingData, onUpdate }`.

`features/booking/lib/schedule.ts` holds the pure booking helpers — `parseDuringRange`,
`occupiedHourRange`, `computeDayStatus`, `hasTimeConflict`, `estimateVenueFee`, `formatPHP`. The
form shape itself, `BookingFormData`, lives in `features/booking/types.ts`. `estimateVenueFee`
mirrors the server's `booking_price()` but is **display-only**; the authoritative fee comes back
from `submit_booking`.

### Dashboard status tables

`features/dashboard/lib/status.ts` maps DB status codes → `{label, color, icon}` for incidents, Yellow
Cards, and bookings. The dashboard tallies donut segments by grouping on `.label`, so statuses that
share a label must share a color — there's no separate grouping table.

## Conventions

- **Everything is a client component.** Nearly every file under `src/app/(citizen)/`, `components/` and
  `features/*/components/` starts with `'use client'`; `src/app/(citizen)/layout.tsx` is the only
  server component of note.
- **Styling is a deliberate hybrid.** Tailwind utilities for color/typography/flex, with design
  tokens in `src/app/(citizen)/globals.css` `@theme` (`--color-lucena-blue: #003DA5`, `--color-lucena-yellow`).
  Page-level layout (spacing, max-widths, grids) uses **inline `style={{}}`**. Responsive behavior
  comes from helper classes in `globals.css` (`.stack-mobile`, `.fluid-media`, `.nav-desktop`,
  `.hide-xs`) that override inline styles via `!important` — SSR-safe, no JS breakpoints. Follow
  this rather than converting layouts to pure Tailwind.
- **File names are kebab-case**; the exported component keeps its PascalCase identifier
  (`components/ui/modal-shell.tsx` exports `ModalShell`). Tests sit next to their source as
  `<name>.test.ts(x)`.
- Imports use the `@/` alias for everything (`@/portals/citizen/features/booking/lib/booking`,
  `@/portals/citizen/lib/validation`).
- `src/shared/supabase/types.ts` is generated from the DB (MCP `generate_typescript_types`) but
  is **not yet wired into Citizen's `createClient`** — the client is untyped and each feature lib hand-rolls its
  row interfaces in the slice's `types.ts`. Treat it as a stale copy, not a source of truth; query the sandbox instead.

## Testing

Vitest with `environment: 'jsdom'` and the app's shared `vitest.setup.ts`. EndUser's own setup
(a stubbed `next/navigation`, `matchMedia`/`scrollIntoView` shims) did not come over with the
merge, since other Portals' tests rely on the real `next/navigation`: a Citizen test that renders a
component calling `useRouter()`/`usePathname()` stubs `next/navigation` itself (see
`src/app/(citizen)/reset-password/page.test.tsx`). Tests live beside their source as
`<name>.test.ts(x)` and cover (a) the pure `map…ToParams` / calculation functions, (b) the
mock-mode branch of each feature lib, and (c) a growing set of component tests. A test that
exercises a mock path touching `lib/mock/request-store.ts` installs the in-memory
`localStorage` polyfill (see the top of `features/booking/lib/booking.test.ts`).

## Planning docs

`docs/superpowers/specs/` holds design docs and `docs/superpowers/plans/` the corresponding
implementation plans, both named `YYYY-MM-DD-topic`. When wiring a feature to the backend, read the
matching spec first — it carries the verified RPC/view/column mapping.

## Status

Capstone prototype mid-migration from localStorage mocks to the Supabase backend. News and
Events Calendar are intentionally WIP (`components/ui/wip-page.tsx`). `TODO(backend)` comments mark
places where a value is assumed rather than verified against the deployed schema — resolve one by
querying the **sandbox** through the `supabase-lucena` MCP, not by guessing.
