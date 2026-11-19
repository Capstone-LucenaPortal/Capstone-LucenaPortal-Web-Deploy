# Responder

The field-unit Portal: LGU responders claim verified incidents from their department's pool,
work them through fixed status stages, and resolve them with photo evidence.

## Language

**On duty**:
A responder's self-declared "I'm working this shift". It is a headcount the department and
Super-staff can see ("3 of 5 on duty"), so an unclaimed incident can be told apart from an empty
shift, and it decides who gets a **Phone alert**. It never hides work: an off-duty responder
still gets the Inbox entry and can browse and claim the pool.
_Avoid_: Available, active (that is the account status)

**Inbox**:
The in-app list of notifications addressed to a responder. Every pool arrival lands here for
every active responder in the department, on duty or not.
_Avoid_: Alerts

**Stale arrival**:
An Inbox entry for a pool arrival whose report is no longer the department's to act on: it was
rerouted to another department, rejected, or closed. It stays in the Inbox, labelled "No longer in
your pool", is never shown as unread and doesn't count toward the unread badge. A report rerouted
away and back again makes its old entry live once more. Claimed and resolved reports are not stale.
_Avoid_: expired, dead notification

**Phone alert**:
A notification shown by the phone itself, outside the app, when a verified incident enters the
department's pool. Sent only to on-duty responders who turned alerts on for that device.
_Avoid_: Push (in UI copy), notification (that is the Inbox entry)

**New cycle**:
A reopened ticket comes back to the pool as a new cycle; **Cycle** and **Reopen** are defined in
[`CONTEXT-MAP.md`](../../../CONTEXT-MAP.md). On My ticket a new cycle starts the stages, the
after-photo cap and Resolve readiness over: the stages may be tapped again from the first, the cap
counts only this cycle's photos, and Resolve waits for an after photo attached this cycle. The
timeline carries every cycle across, and earlier cycles' after photos are hidden, not greyed out.
_Avoid_: round, attempt

**Reroute**:
Defined in [`CONTEXT-MAP.md`](../../../CONTEXT-MAP.md). To responders, a reroute to another
department is a departure and an arrival: the old department's responders lose sight of the report,
and it reaches the new department's pool as an arrival, as if it had just been routed there.
_Avoid_: transfer, reassign

**Reject**:
A responder sending the ticket they hold out of their department, with a reason, because the job
isn't the department's to do. The report leaves the department, belongs to none, and goes back to
Staff to route again, within the cycle already under way. A release is the other way out of a held
ticket, and the difference matters: a release keeps the report in the department, back in its pool
for a colleague, while a reject takes it out of the department altogether. Not the "reject" in the Citizen glossary,
where Staff turn down a Tier Claim: a reject here refuses the department, never the report.
_Avoid_: release (a hand-back to the same department's pool), decline, send back (in docs; the UI
copy says "Send back to staff")
