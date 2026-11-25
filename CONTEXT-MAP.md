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
| **Super-staff** | `/super-staff` | `src/portals/super-staff/` | [`CONTEXT.md`](src/portals/super-staff/CONTEXT.md) | _none yet_ | Posts, announcements and news; staff account administration; **System health**, whether the software itself is working. |
| **Responder** | `/responder` | `src/portals/responder/` | [`CONTEXT.md`](src/portals/responder/CONTEXT.md) | [`docs/adr/`](src/portals/responder/docs/adr/) | Field units claiming incidents from a department pool, working fixed status stages, resolving with photo evidence. |
| **Admin** | `/admin` | `src/portals/admin/` | [`CONTEXT.md`](src/portals/admin/CONTEXT.md) | _none yet_ | Administrator / Mayor review surface: **Service performance** for the three services — requests, backlog, SLA compliance — read from the database's views and RPCs. What each figure means is in [`docs/metrics.md`](src/portals/admin/docs/metrics.md). |

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

### City employee

**City employee**:
Anyone who holds a staff role — Staff, Super-staff, Responder or Admin — and so signs in to one of the four staff-side Portals. Each City employee belongs to exactly one of them. Residents are **Citizens**, never City employees.
_Avoid_: staff (when meaning all four roles — **Staff** is only the Staff Portal's people), worker, user

### Cycle

**Cycle**:
One pass of an incident to resolved. The first cycle runs from the report being filed, and only a **Reopen** starts the next one, back in the department pool; a responder's release or reject is recorded in the cycle already under way. A new cycle starts over what a responder must do before resolving, while the incident's timeline keeps every cycle. The database numbers them in `cycle_number` on each event and photo, and the highest is the current one.
_Avoid_: round, attempt

### Reopen

**Reopen**:
The citizen's "not fixed" on a resolved report. Only the citizen who filed it can reopen it, giving a reason, and only while it is resolved: once they confirm the fix or it closes automatically, a new problem is a new report. A reopen sends the report back to its department's pool with no responder, so anyone there may claim it, starts a new **Cycle** and restarts the SLA clock. The database spells it `reopen_incident`, a `reopened` event and the incident's `reopened_count`.
_Avoid_: release (that is a responder handing a ticket back, within the same cycle), dispute

### Reroute

**Reroute**:
Staff routing a report that was routed before. Only a report nobody holds can be rerouted; a held one must be released first. A reroute to another department takes the report out of the old department's pool and makes it a pool arrival in the new one's; a reroute to the same department, say to change its level, is not an arrival. A reroute is not a new **Cycle**, does not restart the SLA clock, and is not told to the citizen. Routing a report again after a responder's **Reject** is a reroute too. The database spells it a `rerouted` event. See **Routing** in the Staff glossary, and **Reroute** and **Reject** in the Responder glossary.
_Avoid_: transfer, reassign (nobody is assigned until a responder claims it)

### Revocation

**Revocation**:
Staff withdrawing a Yellow Card that should not be honoured — issued to the wrong person, on a false document, or in error — with a reason the Citizen is told. It is final: a revoked card is never reinstated, and Verification tells the Verifier not to accept it. Only an active card can be revoked. It withdraws the card, not the decision: the Yellow Card Application that issued it stays approved, and the Citizen may apply again. It is not how wrong details are fixed; that is a **Correction**. It withdraws the card in the portal only; a printed card the city handed out is recalled by the city. Staff revoke from the review page of the Application that issued the card; the Citizen sees it on their Digital Card; Super-staff find it in the Audit Log. The database spells it `revoke_yellow_card` and a card status of `revoked`.
_Avoid_: Cancellation, Suspension, Deactivation

### Superseded card

**Superseded card**:
A Yellow Card replaced by a newer one issued to the same Citizen, when a **Correction** is approved. It was valid until the moment the replacement was issued, and Verification tells the Verifier to ask for the holder's current card. A revoked card never becomes superseded, and a superseded card is never revoked: it is already not valid, and the card to withdraw is its replacement. The database spells it a card status of `superseded`.
_Avoid_: Old card, Expired card, Replaced card

### Correction

**Correction**:
A Yellow Card Application a Citizen files while holding an active card, to replace the details printed on it. The old card stays valid until the Correction is approved, when it becomes a **Superseded card** and a new card with a new number is issued. The new card belongs to the Correction, so it is revoked from the Correction's review page, not the old card's. Distinct from a **Revision Request**, which fixes an Application before any decision, and from a Profile edit, which never changes a card.
_Avoid_: Amendment, Card update, Reissue

### Incident

**Incident** in this system means an **Incident Report**: a Citizen's report of something in the city (Citizen, Staff and Responder glossaries). ITIL's "incident", a fault in the IT service itself, is a **System issue** here, owned by Super-staff and reported either by System health or by a person. A problem with the portal is never filed as an Incident Report, and a System issue is never routed to a department.
_Avoid_: incident (when meaning a fault in the portal — say System issue)

### Monitoring

**Monitoring** means two different things depending on the Portal. Since #72 (ADR 0008) Super-staff's old Monitoring screen is **System Health**:
- **Admin**: *service performance* — SLA compliance, backlog, at-risk, bookings, read from Admin's own views and RPCs. Admin owns these numbers and is measured against them.
- **Super-staff**: *system health* — background jobs, notification delivery, capacity and response time, read from `super_system_health()` and its two views, at `/super-staff/system-health`. Super-staff shows four service-performance tiles there (from `super_metrics`) as **Service impact**, to judge a configuration change, but does not own them.
_Avoid_: monitoring (say service performance or system health)

## System-wide decisions

ADRs that span Portals or repos live in
[`Central-System-Documents/docs/adr/`](https://github.com/Capstone-LucenaPortal/Central-System-Documents/tree/main/docs/adr)
(cloned as a sibling, so `../Central-System-Documents/docs/adr/` locally), indexed in that
repo's [README](https://github.com/Capstone-LucenaPortal/Central-System-Documents#system-wide-decisions).
A system-wide ADR outranks a Portal's. 0003–0006 are the merge decisions that shaped this repo.
