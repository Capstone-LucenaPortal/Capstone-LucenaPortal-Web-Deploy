export interface PreviewItem {
  id: string;
  label: string;
  tag: {
    text: string;
    tone: "critical" | "high" | "warning" | "neutral";
  };
}

export interface YellowCardCardData {
  module: "yellow-card";
  pending: number;
  /** Both from staff_yellow_card_queue.deadline_state (l80), in Working Time. */
  atRisk: number;
  overdue: number;
  preview: PreviewItem[];
}

export interface IncidentsCardData {
  module: "incidents";
  /** The module's arrival set and its backlog — see CONTEXT.md. */
  awaitingTriage: number;
  critical: number;
  high: number;
  slaBreaches: number;
  preview: PreviewItem[];
}

/**
 * Re-keyed to the real pipeline.
 *
 * `preliminaryApproved` is gone: it corresponded to no database status and
 * never did. `pending` goes too: since l77b it is reachable (a discounted
 * booking before its Organisation Document is uploaded), but it is the
 * organiser's turn, so it is no figure for a desk's card. A Tier Claim waiting
 * on review reaches this card through the Needs Action preview.
 */
export interface BookingCardData {
  module: "booking";
  awaitingQuote: number;
  paymentVerification: number;
  /**
   * A COUNT of `confirmed` bookings with money still owed — not a peso figure.
   *
   * ⚠️ The queue page's summary card of the same name IS pesos. They are
   * deliberately different: the dashboard row is three counts side by side and
   * a currency figure in the middle of them reads as a quantity. All three here
   * have to be counts because module-stat-card renders them through the same
   * <Figure>.
   */
  balanceOutstanding: number;
  preview: PreviewItem[];
}

export type ModuleCardData =
  | YellowCardCardData
  | IncidentsCardData
  | BookingCardData;
