import type {
  BookingConfig,
  IncidentsConfig,
  YellowCardConfig,
} from "../types";
import { INCIDENT_LEVELS } from "../types";
import { isChangeoverHours } from "./validation";


export type IncidentImpact = {
  sla: string | null;
  atRisk: string | null;
  unverified: string | null;
};

export function incidentImpact(
  saved: IncidentsConfig,
  draft: IncidentsConfig,
): IncidentImpact {
  const slaClauses = INCIDENT_LEVELS.filter(
    (level) => saved.slaHours[level] !== draft.slaHours[level],
  ).map(
    (level) =>
      `New ${level} incidents will use ${draft.slaHours[level]}h instead of ${saved.slaHours[level]}h.`,
  );
  const sla = slaClauses.length
    ? `${slaClauses.join(" ")} In-flight incidents keep their armed target.`
    : null;

  const atRisk =
    saved.atRiskThresholdPct !== draft.atRiskThresholdPct
      ? `Incidents will flag as at-risk once ${draft.atRiskThresholdPct}% of the SLA window has passed (was ${saved.atRiskThresholdPct}%).`
      : null;

  // The three lifecycle knobs are live as of l57 — a nightly sweeper reads them.
  const unverified =
    saved.nudgeDay !== draft.nudgeDay ||
    saved.autoCloseDay !== draft.autoCloseDay ||
    saved.confirmationWindowDays !== draft.confirmationWindowDays
      ? `The nightly sweeper nudges a reporter on day ${draft.nudgeDay}, auto-closes a resolved report on day ${draft.autoCloseDay}, and closes a never-verified report after ${draft.confirmationWindowDays} days.`
      : null;

  return { sla, atRisk, unverified };
}

export type YellowCardImpact = {
  target: string | null;
  atRisk: string | null;
};

/**
 * The two knobs land differently, and the notes must not blur them: the
 * target is snapshotted onto each application at submission, while the
 * threshold is read live by the database on every queue read (l80).
 */
export function yellowCardImpact(
  saved: YellowCardConfig,
  draft: YellowCardConfig,
): YellowCardImpact {
  const days = draft.processingTimeTargetDays;
  const target =
    saved.processingTimeTargetDays !== draft.processingTimeTargetDays
      ? `Applications should reach a decision within ${days} working day${days === 1 ? "" : "s"}. Applies to new applications only.`
      : null;

  const atRisk =
    saved.atRiskThresholdPct !== draft.atRiskThresholdPct
      ? `Staff will see an application as at risk once it has used ${draft.atRiskThresholdPct}% of its processing target in working time (was ${saved.atRiskThresholdPct}%). Applies at once to every running application.`
      : null;

  return { target, atRisk };
}

export type BookingImpact = {
  financial: string | null;
  hours: string | null;
  changeover: string | null;
};

const CHANGEOVER_KEPT =
  "Bookings already made keep the changeover they were booked with.";

/**
 * ADR 0010: each Booking keeps the Changeover in force when it was submitted,
 * so the note always says so. At 0 the "N hour(s)" wording would be nonsense,
 * the same reason submit_booking drops it at 0 (l117 §5). Silent on a value
 * the form is refusing, which the field's own error already names.
 */
function changeoverImpact(saved: BookingConfig, draft: BookingConfig) {
  const n = draft.changeoverHours;
  if (saved.changeoverHours === n || !isChangeoverHours(n)) return null;
  if (n === 0) {
    return `New bookings will have no changeover: the space can be booked again as soon as the event ends. ${CHANGEOVER_KEPT}`;
  }
  return `Each new booking keeps its space free for ${n} hour(s) after the event so the LCC can reset it. ${CHANGEOVER_KEPT}`;
}

export function bookingImpact(
  saved: BookingConfig,
  draft: BookingConfig,
): BookingImpact {
  const financial =
    saved.downpaymentPct !== draft.downpaymentPct ||
    saved.paymentWindowHours !== draft.paymentWindowHours
      ? `A ${draft.downpaymentPct}% downpayment confirms a booking, and an unpaid hold is swept ${draft.paymentWindowHours} hours after it is placed.`
      : null;

  const hours =
    saved.openingHour !== draft.openingHour ||
    saved.closingHour !== draft.closingHour ||
    saved.minDurationHours !== draft.minDurationHours
      ? `The citizen booking form will offer ${draft.openingHour}:00–${draft.closingHour}:00 with a ${draft.minDurationHours}-hour minimum. It reads these live, so the change is visible on the next page load.`
      : null;

  return { financial, hours, changeover: changeoverImpact(saved, draft) };
}
