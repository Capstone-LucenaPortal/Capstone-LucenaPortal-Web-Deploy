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
