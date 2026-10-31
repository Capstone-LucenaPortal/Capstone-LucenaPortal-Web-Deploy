# CONTEXT

The glossary for this repo. It covers the terms that are **genuinely ambiguous**
— pairs that look interchangeable and are not, and words the database and the
portal use differently. Obvious nouns are left out on purpose: a glossary that
restates everything gets skimmed and then ignored.

`docs/agents/domain.md` is how the skills consume this file. There is no
`docs/adr/` yet; per that document, ADRs are created lazily when a decision
actually gets resolved, so its absence is by design, not an omission.

---

## Posts, announcements and news

**Post** is the database's word. `platform_posts` holds both kinds, and
`content_type` (`announcement` | `news`) tells them apart. The RPCs are
`create_post` / `update_post` / `set_post_published`.

**Announcement** is the portal's word for the feature and its screens
(`src/features/announcements`, `/announcements`), which manage *both* content
types. So `Announcement` the type covers a row that may be news — the feature is
named after the common case, not the whole set.

Use "post" when talking about the table, the RPCs or the audit trail; use
"announcement" for the portal surface.

## PostCategoryOption vs PostCategory

Two types, two views, two purposes. They shared a name until ticket 08 and it
made two unrelated reads look interchangeable.

| | `PostCategoryOption` | `PostCategory` |
|---|---|---|
| Where | `features/announcements/types.ts` | `features/configuration/lib/catalog-types.ts` |
| Read from | `public_post_categories` | `super_post_categories` |
| Carries | code, label, colorHex | + sortOrder, isActive |
| For | one choice in an author's picker | the editable catalog row |

The catalog row is the full entity, sibling to `Department` and `BookingVenue`.
The option is only what a post or event author picks between.

**`color_hex` is owned by the database**, not the portal. The original PRD
assumed category colours were presentation-side; they are not.

## IncidentLevel vs IncidentBaseLevel

Two vocabularies that look alike and type-check nowhere near each other.

- **`IncidentLevel`** — capitalised (`"High"`), the portal's own. It keys
  `slaHours` onto the `sla_hours_high` columns. `INCIDENT_LEVELS` is its
  canonical severity order, most urgent first.
- **`IncidentBaseLevel`** — the database `incident_level` enum, LOWERCASE
  (`"high"`). It is an incident type's public response-time promise, read-only
  in the portal and owned by the LGU.

## Catalog

A code-keyed row set that **migrations own**: departments, incident types,
booking venues, booking event types, booking classifications, yellow-card
document types, post categories.

Two rules follow, and both are load-bearing:

- **Rows are never created or deleted from the portal.** `code` is a primary key
  referenced by incidents, bookings and friends, so a row can never truly go
  away. **Deactivation is the only retirement**, which is why `isActive` matters.
- **An inactive row stays visible and editable.** Being able to see and
  reactivate a retired row is the entire reason the `super_*` catalog views
  exist — never filter them by `is_active`.

`BookingClassification` has no `isActive`; that table has no such column and one
must not be invented.

## Holidays are not a Catalog

The Holidays editor borrows the catalog machinery — `CatalogCard`,
`useCatalogEditor`, the retire-don't-delete rule, the unfiltered `super_*` view —
but a **Holiday** is not a catalog row. It is keyed by a uuid, not a
migration-owned `code`, and the portal **does create** it: `add_holiday` exists
so a typhoon suspension declared at 7 a.m. counts without a developer. It is
still **never deleted**; a retired Holiday is reactivated, and a Holiday on the
wrong date is retired and the right date added, because `update_holiday` does
not take the date.

The retired badge says **Retired**, not the catalogs' "Inactive".

## Office Hours: the schedule vs the text

Two things, one name — the pair the DB repo's CONTEXT § "Processing time" warns
about.

| | **Office Hours** (the schedule) | the office-hours text |
|---|---|---|
| Read from | `super_office_hours`, one row per ISO weekday | `super_site_info.office_hours` |
| Written by | `set_office_hours` | `save_site_info` |
| Is | `time` open/close per weekday, both null = closed | free display copy for Citizens |
| Drives | Working Time, so every Yellow Card Processing Deadline | nothing |
| Screen | Configuration → Holidays & Office Hours | Configuration → Site Info |

They are **not synchronised** and may disagree; l70b left them apart on
purpose. Capitalised "Office Hours" in this portal always means the schedule.

**Every calendar save recomputes the running deadlines.** `add_holiday`,
`update_holiday` and `set_office_hours` each end by moving the Processing
Deadline of every open Yellow Card application whose clock is running, even on
a no-op save. The screen says so before anyone saves.

**`24:00` is a legal close** meaning end of day, which is why the time fields are
text inputs: `<input type="time">` cannot hold it.

## super_* views

Gated definer views, and the portal's only read path — base tables are revoked
from `authenticated`.

**They self-scope.** Never add an `.eq()` for permission; the view already did
it. A caller the gate refuses gets **zero rows**, not an error, which is why an
empty one-row config view reads as *not authorised* rather than *config
missing*.

**Every column is typed nullable** in the generated types, whatever the base
table declares — PostgREST cannot see a view's own guarantees. So a row arrives
pessimistic and gets narrowed once, at the read:

- `rows()` / `maybeRow()` / `singleRow()` in `lib/supabase/select` unwrap the
  result. No feature module casts a row; a guard test enforces that.
- `requiredColumn()` turns a column the base table declares NOT NULL back into a
  value, and **throws rather than substituting** — §7.1 requires the portal
  "must not render a null as `0`".
- A row missing the column that identifies it is **dropped**, not defaulted: it
  can neither be rendered nor written back.

## AuditEntry, AuditRow, TimelineItem

One trail, three shapes, in order:

- **`AuditRow`** — what `super_audit_log` hands over, every column nullable.
- **`AuditEntry`** — the domain type, narrowed from a row by `toEntry`.
- **`TimelineItem`** — how an entry renders in a record's history, via
  `toTimelineItem`. This is a **presentation** shape and belongs to audit-log,
  not to the editors that display it.

**Histories match on `targetId`, never on the label** — a rename must not orphan
a record's history.

## Status is derived, never stored

`post_status(is_published, start_at, end_at)` computes Draft / Scheduled /
Published / Expired in the database. The portal **reads** it and never sends it.
Publication is its own RPC (`set_post_published`) for posts; for events it is
part of the same update call.

## Explore Lucena is shelved

Super Staff does **not** edit Explore Lucena (SCRUM-185). The content stays
hardcoded in the citizen portal (`Capstone-LucenaPortal-EndUser`,
`src/app/explore-lucena/page.tsx`); "changeable by IT" means the dev team edits
that file and redeploys. The editor, its `/explore` routes and the `"place"`
image kind were removed, so `/explore` 404s.

The database side was left in place, unused: `site_places`, `public_places`,
`super_places` and `create_place` / `update_place` / `reorder_places`. Past
place entries remain readable in the Audit Log. Reviving the editor is a revert,
which is why there is no ADR.

## Stored instants are UTC; the input speaks Manila

The city runs on Philippine time (+08:00), but the database does **not** store
that offset. `start_at` / `end_at` are `timestamptz` and the database's
`TimeZone` is `UTC`, so PostgREST returns instants normalised to UTC —
`2026-08-21T09:00:00+00:00`, never `+08:00`. A `datetime-local` input, meanwhile,
speaks bare wall clock with no offset at all.

`src/lib/datetime.ts` is the only place that bridges the two, and it must
**convert**, never slice. Slicing the string treats a UTC wall clock as a Manila
one, and because `localInputToIso` then re-stamps it `+08:00`, every save wrote
an instant eight hours earlier than the one it had just read — silent data
corruption, plus a spurious "Start date changed" in the audit log on saves that
touched no date. That was ticket 11; the header comment asserting stored strings
"carry the Philippine +08:00 offset" was the false premise behind it.

Test fixtures for anything that round-trips a stored date must therefore be
written in `+00:00`. A `+08:00` fixture round-trips string-identically under
both the broken and the fixed helper, so it cannot fail.

## imagePath

Set on first upload and then **stable** — a replacement reuses the same path,
which is what keeps `update_post` from logging a spurious "Image changed".

⚠️ The update RPCs have **no argument defaults**, so `p_image_path` is written on
every call. The hazard that creates is an **explicit null**, not an omitted
argument. Omitting `p_image_path` cannot wipe anything: PostgREST resolves an
RPC by argument *names*, so a missing name matches no signature and the call
fails with `PGRST202` / HTTP 404 before the function is entered. What wipes a
live image is sending `p_image_path: null`, which the database cannot tell apart
from "clear this image" — it succeeds with a 200.

The portal's protection is that the loaded row's path is carried back out
through `toFormValue` → `toInput` → `toUpdateXArgs`; a caller that stops seeding
it falls back to `EMPTY.imagePath`, which *is* null. `form-value.test.ts` holds
that chain end to end. DB repo `docs/what-not-to-do.md` §10 carries the live
probe.

## Schema work lives in the DB repo

Migrations, RPCs and the SQL assertions that prove them are authored and applied
**only** from `../Capstone-LucenaPortal-DB`, which owns the honour-system **G0–G7
change pipeline** and has no CI. Schema is numbered in layers
(`supabase/migrations/*_l<NN>_*.sql`), each proved by a matching
`supabase/tests/assert_l<NN>.sql` whose numbered `G` assertions are a different
thing from the pipeline's gates. From this repo the database may be **read,
called and observed** — never altered.

The Sandbox project is at **l91** (verified 2026-10-31). Production was last
recorded at **l40** and is paused, so its current layer could not be checked —
treat every layer after l40 as Sandbox-only until someone confirms otherwise.
