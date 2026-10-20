# Lucena Portal — Staff

The staff-side portal for the Lucena LGU. Municipal staff work three queues here:
Yellow Card applications, Incident reports, and LCC Booking requests. This file is
the glossary those three modules share.

## Language

### Queue work

**Queue**:
The whole-view list of one module's records, filtered by a status tab. Every figure
a queue shows is whole-view — it does not change when someone clicks a tab.
_Avoid_: List, inbox, dashboard (the Dashboard is a separate, cross-module screen).

**Arrival**:
Work that has appeared in a queue since the person looking at it loaded the page.
A count of arrivals answers "has the office moved on without me", and nothing else.
_Avoid_: New (too vague — see Backlog, which is also colloquially "new work").

**Backlog**:
Every record currently waiting on a member of staff, regardless of when it arrived.
A record can join the backlog long after it arrived, so a backlog figure is not an
arrival figure.
_Avoid_: Pending, outstanding, queue depth.

**Needs Action**:
The Booking module's backlog. Bookings waiting on a person in this building —
a Tier Claim to review, a quote, a payment to be checked, or a balance to be
recorded. A Booking waiting on a Resubmission is the Citizen's turn, so it is
not in the set.
The queue shows this set twice over: the sentinel tab is its level, and the
activity badge is its growth since the page loaded — "3 more waiting", never
"3 new". A booking joins the set when a colleague verifies a payment across the
room, which is new work but not a new booking, so "new" would report a
submission that never happened.
_Avoid_: New (see Arrival — a different question, which this badge does not ask).

**Awaiting Review**:
The Yellow Card module's backlog. Applications waiting for a reviewer's decision.
In this module backlog and arrival coincide: an application joins the set only by
being submitted or resubmitted.

**Awaiting Triage**:
The Incidents module's arrival set. Reports nobody has routed to a department yet,
whether or not the reporting citizen has verified them — deciding which is what
triage *is*.
It is also this module's backlog, which is why no separate term names one. Once an
incident is routed it is the department's to chase, so nothing past routing is
waiting on a member of staff in this building: here the two questions have the
same answer, under an arrival-shaped name.
_Avoid_: Routable (a narrower, routing-specific rule that happens to overlap),
Open (the raw status value; use the label).

### Notifications

**Notifications**:
The notices the database has addressed to one member of staff, reached from the bell
in the navbar. Today every one is a Yellow Card Deadline Notice (an application
turned At Risk or Overdue; the term is defined in the database's `CONTEXT.md`,
§ Processing time). Opening one marks it read and opens its application. Each
shows how its application stands now, and deciding the application neither marks nor
hides it, so a warning that has become moot still reads as a record that it was sent.
The bell's figure is the unread count, never "new" work: a Notification is a message
to one person, not a record waiting in a Queue.
_Avoid_: Inbox (already named as a misuse of the Queue above), Alerts.

### Documents

**Document**:
A file a citizen uploaded in support of a record — a Yellow Card requirement, a
booking's organisation papers or GCash receipt, an incident photo. Whether a
member of staff may see one is decided afresh each time they ask for it, and is
never granted as a durable link. Incidents call theirs photos and the tables
disagree about the word; the entitlement rule does not distinguish them, and
neither does this term.
_Avoid_: Attachment, upload, file.

### Incidents

**Verified**:
A citizen has confirmed their own report. An unverified report has no SLA clock.
_Avoid_: Confirmed (that is a closure reason, and a different event).

**Routing**:
Handing an incident to a department. It is not handing it to a person — nobody
owns an incident until a responder claims it, which is why a routed incident
reads as *In Pool*.
_Avoid_: Assignment, allocation.

**Breach**:
An incident that passed its SLA deadline. A property of one specific row, never a
queue-level signal, and never conflated with Arrival — the two point a responder in
opposite directions.
_Avoid_: Overdue, late, missed.

**At Risk**:
An incident far enough through its SLA window — against a threshold the office
configures — that it is likely to breach. Like Breach it is a property of one row,
derived from that row's deadline and the moment it is read rather than held as a
status or a column. It is on screen twice: a badge on each row, and the card above
the queue table counting the rows that carry it. That card is a count of rows, not
a state the queue is in.
_Avoid_: "The queue is at risk" (rows are; the queue is not — the guard Breach
carries, and the one this term is likelier to lose, having a figure over it),
Breaching and overdue (the deadline has already passed — that is Breach),
Critical (a level, not a clock).
