/** Domain types for the citizen dashboard slice. */

export interface StatusMeta {
  label: string;
  color: string;
  icon: string;
}

export interface YellowCardStatusDisplay {
  label: string;
  color: string;
  icon: string;
  ref: string | null;
  dateLabel: string;
  date: string | null;
  reason?: string;
}
