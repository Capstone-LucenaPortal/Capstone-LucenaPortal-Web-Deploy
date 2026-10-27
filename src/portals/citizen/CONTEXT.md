# Lucena City Portal — Citizen Context

The citizen-facing side of the Lucena City Portal: the language residents of Lucena City and the
staff serving them use to talk about the four things a citizen can do here — hold a Yellow Card,
report an incident, book the convention center, and browse city content.

This is a glossary, not a spec. Implementation lives in the code; decisions live in `docs/adr/`
and `docs/superpowers/specs/`.

## Language

### People and places

**Citizen**:
A person who uses the portal on their own behalf. The portal has exactly one kind of human user;
staff and responders work in the sibling portals, not this one.
_Avoid_: Resident, User, End user, Applicant, Requester

**Verifier**:
The person a Citizen presents their Yellow Card to — a barangay official, an inspector, an
establishment's clerk — checking that it is real. Not a Citizen, and needs no account: they meet
the portal only through Verification.
_Avoid_: Scanner, Checker, Inspector (as the general term)

**Citizen Profile**:
The single record of who a Citizen is — name, birth date, address, contact details. One per
Citizen, and a prerequisite for every service the portal offers.
_Avoid_: Account, User record, Registration

**Barangay**:
The smallest administrative division of Lucena City, and the unit every address in the portal is
filed under. Always chosen from the official list, never typed freely.
_Avoid_: District, Zone, Area, Neighborhood

### Cross-cutting

**Reference Number**:
The human-quotable identifier a Citizen is given for a submission, and the thing they will read
aloud over the phone. Each service has its own prefix.
_Avoid_: Tracking number, Ticket number, Confirmation code, ID

**Catalog**:
An authoritative, staff-maintained list the portal offers as choices — barangays, incident types,
venues, event classifications. Catalogs are the only legitimate source of the choices in a
dropdown.
_Avoid_: Lookup table, Enum, Reference data, Master data

**Code**:
The stable identifier of a Catalog entry, and the value that travels with a submission. Distinct
from the **Label**, which is the human-readable text shown beside it and may be reworded at any
time.
_Avoid_: Key, Slug, Value, Type string

### Yellow Card

**Yellow Card**:
The health credential the city issues to a Citizen. It exists only once granted, carries its own
card number and validity dates, and can be publicly verified by a third party.
_Avoid_: ID, Health card, Certificate

**Digital Card**:
The image of a Yellow Card a Citizen views and downloads from the portal: the holder's name and a
scannable code, nothing else. It carries no photo and no signature — the printed card the city
hands out has those — so it proves who holds the card only alongside another ID.
_Avoid_: Digital ID, E-card, Virtual card, QR card

**Verification**:
A Verifier's check, made by pointing their phone's camera at a Digital Card's code, of whether a
Yellow Card is genuine and still valid. It answers with the card's status and the holder's name
only — the name is what the Verifier compares against the card in front of them.
_Avoid_: Validation, Lookup, Scan

**Yellow Card Application**:
A Citizen's request to be issued a Yellow Card, tracked from submission through decision. Distinct
from the **Yellow Card** itself — an Application may never become one, and a Citizen may have
several Applications over time but at most one active Card.
_Avoid_: Yellow Card request, Form, Submission

**Revision Request**:
A reviewer's decision that an Application — or a Booking's Tier Claim — cannot be judged as
submitted and needs the Citizen to correct something. It is not a refusal — the Application or
Booking stays alive and awaits the Citizen.
_Avoid_: Rejection, Denial, Correction, Bounce-back

**Resubmission**:
A Citizen's answer to a Revision Request: the same Application or Tier Claim, sent back with
corrections. It never creates a second Application or Booking.
_Avoid_: Reapplication, New application, Resubmit

**Duplicate Review**:
A flag on an Application saying a human must check whether this Citizen already holds or has
applied for a Card, before any decision is made.
_Avoid_: Dedup, Deduplication, Dupe check

### Incidents

**Incident Report**:
A Citizen's account of something in the city that needs attention, filed against a location and a
Barangay. It is a report of an event, never a request for a service.
_Avoid_: Complaint, Ticket, Case, Issue, Request

**Incident Type**:
The Catalog entry that classifies what kind of event is being reported, and which determines who
it is routed to and how urgently.
_Avoid_: Category, Kind, Subject

**Incident Level**:
How urgently an Incident Report must be answered. Derived from the Incident Type rather than
chosen by the Citizen.
_Avoid_: Severity, Priority, Urgency, Tier

**Anonymous Report**:
An Incident Report the Citizen chose to file without attaching their identity to it for staff.
They remain signed in and can still track it.
_Avoid_: Unattributed report, Private report, Guest report

**Verified Incident**:
An Incident Report that staff have confirmed corresponds to something real, as distinct from one
merely received.
_Avoid_: Confirmed report, Validated report, Approved report

### Convention center booking

**LCC**:
The Lucena Convention Center — the single facility this portal takes bookings for. Spelled out on
first use in citizen-facing copy.
_Avoid_: Convention center (alone), The center, Lucena CC

**Booking**:
A Citizen's reserved use of an LCC Venue for a dated event, from request through to the event
itself. The **Event** is what happens; the Booking is the arrangement to hold it.
_Avoid_: Reservation, Event (as a synonym), Rental

**Venue**:
One of the four things the LCC sells as a single choice — the Atrium, the Sports Arena, the Full
Facility, or rehearsal access. A Venue is a product, not a room: one Venue may take up two Spaces,
and two Venues may be the same Space hired on different terms.
_Avoid_: Hall, Room, Facility, Location

**Space**:
One of the two physical rooms the LCC is made of — the Atrium and the Arena. A Citizen never sees
or chooses a Space, but it is the reason two differently-named Venues can clash on the same
afternoon.
_Avoid_: Venue, Sub-venue, Section, Zone

**Occupancy**:
A Booking's claim on a single Space for a single stretch of time. A Booking claims every Space its
Venue is made of, and holds them from the moment it is submitted until it is cancelled — which is
why two Bookings collide when they share a Space, not when they share a Venue.
_Avoid_: Slot, Block, Booked time, Reservation

**Classification**:
What kind of organisation is holding the event, which is what determines whether it is charged
commercial or discounted rates.
_Avoid_: Category, Customer type, Segment

**Rate Tier**:
Whether a Booking is charged commercial or discounted rates. Decided by the city from the
Classification, never chosen by the Citizen.
_Avoid_: Discount, Pricing tier, Rate type, Price band

**Tier Claim**:
A Citizen's assertion that a Booking qualifies for the discounted Rate Tier, backed by an
Organisation Document. A Booking carrying an undecided Tier Claim cannot take a Downpayment.
Skipping the Organisation Document is giving up the claim — the Booking proceeds at commercial
rates.
_Avoid_: Discount, Discount claim, Discount request, Proof of discount

**Organisation Document**:
The proof a Citizen uploads to support a Tier Claim.
_Avoid_: Supporting document, Proof, Attachment

**Tier Review**:
Staff's decision on a Tier Claim: accept it, issue a Revision Request, or reject it. A Tier Claim
allows one Resubmission; rejecting it leaves the Citizen to continue at commercial rates or cancel.
_Avoid_: Discount review, Document confirmation, Verification

**Quote**:
A staff-set price for a Booking whose cost cannot be computed from the published rates. A Booking
awaiting one has no fee yet, not a fee of zero.
_Avoid_: Estimate, Custom price, Manual price

**Estimate**:
The indicative fee the portal shows a Citizen while they are still filling in the form. Always
provisional — the city's own figure supersedes it the moment a Booking is submitted.
_Avoid_: Price, Fee, Cost, Computed fee

**Downpayment**:
The portion of the total fee a Citizen must pay to secure a Booking, with the remainder due before
the event.
_Avoid_: Deposit, Partial payment, Advance

**Hold**:
The limited window during which a Booking waiting on the Citizen — for its Organisation Document,
a Downpayment or a Resubmission — keeps its Occupancies before they are released back to general availability. Time
spent waiting on staff never counts against it.
_Avoid_: Reservation window, Lock, Grace period, Pending period
