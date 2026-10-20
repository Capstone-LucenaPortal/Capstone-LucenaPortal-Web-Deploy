# Context Map — Capstone-LucenaPortal-Web

This repo is the one Lucena City web app. It holds five **Portals**, one per audience, each in
its own folder under `src/portals/` and each a bounded context with its own vocabulary. This
file is the index of those contexts; it is not itself a glossary.

The app was five repos until the 2026-10 merge
([ADR 0003](https://github.com/Capstone-LucenaPortal/Central-System-Documents/blob/main/docs/adr/0003-five-frontends-become-one-nextjs-app-not-a-workspace.md));
the old repos are archived. The database and the system-wide docs are the other two repos of
the system, `Capstone-LucenaPortal-DB` and `Central-System-Documents`.

`docs/agents/domain.md` is how the engineering skills consume this file.

## The contexts

| Context | Path prefix | Folder | Glossary | ADRs | What it owns |
| --- | --- | --- | --- | --- | --- |
| **Citizen** | `/` | `src/portals/citizen/` | [`CONTEXT.md`](src/portals/citizen/CONTEXT.md) | _none yet_ | What a resident can do: hold a Yellow Card, report an incident, book the convention center, browse city content. |
| **Staff** | `/staff` | `src/portals/staff/` | [`CONTEXT.md`](src/portals/staff/CONTEXT.md) | [`docs/adr/`](src/portals/staff/docs/adr/) | The three municipal-staff queues: Yellow Card applications, Incident reports, LCC Booking requests. |
| **Super-staff** | `/super-staff` | `src/portals/super-staff/` | [`CONTEXT.md`](src/portals/super-staff/CONTEXT.md) | _none yet_ | Posts, announcements and news; staff account administration. |
| **Responder** | `/responder` | `src/portals/responder/` | [`CONTEXT.md`](src/portals/responder/CONTEXT.md) | [`docs/adr/`](src/portals/responder/docs/adr/) | Field units claiming incidents from a department pool, working fixed status stages, resolving with photo evidence. |
| **Admin** | `/admin` | `src/portals/admin/` | _not written yet_ | _none yet_ | Administrator / Mayor review surface and SLA compliance reporting, read from the database's views and RPCs. |

A Portal's ADRs, when it has any, live in `docs/adr/` inside its folder and keep the numbering
they had in the old repo. This repo holds only Portal-level ADRs; a decision spanning Portals
or repos goes to Central-System-Documents.

A missing glossary or ADR folder is not a gap to fill upfront — `/domain-modeling` writes one
when a term or decision actually gets resolved.

## Where the contexts disagree

Terms whose meaning genuinely differs between Portals belong here, not in any single Portal's
glossary. Add a subsection per term as the disagreements surface, recording what the term means
in each Portal and, where relevant, which spelling the database uses.

### Portal

**Portal**:
One audience's section of the single Lucena web app — Citizen, Staff, Super-staff, Responder or Admin — reached by its path prefix (Citizen owns the root). Since the 2026-10 merge (ADR 0003) a Portal is no longer a repo or a separately deployed app.
_Avoid_: app, frontend, repo (when meaning an audience's section)

## System-wide decisions

ADRs that span Portals or repos live in
[`Central-System-Documents/docs/adr/`](https://github.com/Capstone-LucenaPortal/Central-System-Documents/tree/main/docs/adr)
(cloned as a sibling, so `../Central-System-Documents/docs/adr/` locally), indexed in that
repo's [README](https://github.com/Capstone-LucenaPortal/Central-System-Documents#system-wide-decisions).
A system-wide ADR outranks a Portal's. 0003–0006 are the merge decisions that shaped this repo.
