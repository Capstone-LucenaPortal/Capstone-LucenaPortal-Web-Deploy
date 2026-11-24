# Lucena Portal — Admin

The Administrator and Mayor's review surface. It reports **Service performance** for the three
services — Yellow Card, Incident reports and LCC Booking — and owns those numbers (ADR 0008).
This file is the glossary its figures share.

## Language

### Kinds of figure

**Volume figure**:
A count of activity — how much was filed, decided or booked. It says how busy a service was,
never how well it performed, and its label must read as a count.
_Avoid_: engagement, performance (for a count)

**Effectiveness figure**:
A figure that says how well a service kept its promise to the resident, judged against a
stated target or direction.
_Avoid_: KPI (when meaning only this kind — every tile is a KPI tile)

### Requests and queues

**Service request**:
One submission to one service: a Yellow Card application, an incident report or a booking.
A resident who files three times makes three service requests.
_Avoid_: citizen engaged, citizen, engagement (a request is not a person)

**Service backlog**:
Every service request currently waiting on the city, regardless of when it was filed. A request
whose next move is the resident's — a Yellow Card in revision, a booking awaiting payment or a
resubmission — is not in it. Its Yellow Card and Booking parts are exactly the Staff Portal's
**Backlog** for those modules, so a confirmed booking with its balance still to record is in it.
_Avoid_: pending, open requests, queue

**Past due**:
A request still waiting on the city whose promised time has already run out.
_Avoid_: breached (a breach is scored once the request is finished), late, overdue backlog

### Scoring against the clock

**Scoreable request**:
A service request whose turnaround outcome is known and fairly charged to the city: an approved
or rejected Yellow Card application, an incident resolved after its clock started and not
closed as invalid, duplicate or expired, or a booking request the city confirmed or refused
with a clock on it. A withdrawal is not scoreable: the resident ended it, not the city; nor is
a booking the organiser cancelled or let expire, nor an incident never routed and verified,
which had no clock to miss.
_Avoid_: decided (a withdrawal is decided but not scoreable), response

**Decided on time**:
The share of a service's decided requests the city decided within their promised time: Yellow
Card applications approved or rejected within three Working Days, and booking requests
confirmed or refused by staff before their Confirmation Deadline. A refusal on time counts as
on time; the figure measures the desk's speed, not its answer.
_Avoid_: confirmed on time (a refusal is decided too), approval speed

**Time to triage**:
How long an incident report waited from filing until it was routed to a department. It sits
outside the incident's clock, so it is reported on its own.
_Avoid_: response time (the city has not responded to the resident yet)

**Time to resolve**:
How long an incident report took from filing until a responder resolved it, across every
level. It includes triage and the wait for the resident's photo, so it is not the clock.
_Avoid_: response time, average response, SLA time

**Resolved on time**:
The share of an incident's scoreable reports resolved before their own level's due time,
counted from when the report was both routed and verified.
_Avoid_: response rate

**SLA compliance**:
The share of scoreable requests the city finished within their promised time.
_Avoid_: performance, on-time rate

### Convention Center

**Booking request**:
A booking as the organiser filed it, whatever became of it — confirmed, rejected, cancelled or
expired. Counting booking requests measures demand, not events held.
_Avoid_: booking (when meaning a confirmed event), reservation

**Event day**:
A calendar day with at least one confirmed booking — confirmed, fully paid or completed — at
the Convention Center. A request still being reviewed, quoted or paid for does not make one.
_Avoid_: utilization, occupancy, booked day
