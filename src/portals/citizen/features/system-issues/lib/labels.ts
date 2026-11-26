import type {
  SystemIssueCategory,
  SystemIssueCloseReason,
  SystemIssueDisplayStatus,
} from '@/portals/citizen/features/system-issues/types';

/** "Which part of the website?", worded as the database's
 * `system_issue_category_label()` words it. */
export const SYSTEM_ISSUE_CATEGORY_LABEL: Record<SystemIssueCategory, string> = {
  yellow_card: 'Yellow Card',
  incidents: 'Incidents',
  lcc: 'LCC Bookings',
  accounts: 'Accounts & sign-in',
  website: 'The website in general',
};

/** Each derived status's pill: its label and colours. */
export const SYSTEM_ISSUE_STATUS_META: Record<
  SystemIssueDisplayStatus,
  { label: string; background: string; color: string }
> = {
  open: { label: 'Open', background: '#DBEAFE', color: '#1E40AF' },
  in_progress: { label: 'In progress', background: '#FEF3C7', color: '#92400E' },
  resolved: { label: 'Resolved', background: '#DCFCE7', color: '#166534' },
  closed: { label: 'Closed', background: '#E5E7EB', color: '#374151' },
};

export const SYSTEM_ISSUE_CLOSE_REASON_LABEL: Record<SystemIssueCloseReason, string> = {
  not_a_system_issue: 'Not a system issue',
  duplicate: 'Duplicate',
};

export function isSystemIssueDisplayStatus(value: unknown): value is SystemIssueDisplayStatus {
  return typeof value === 'string' && Object.hasOwn(SYSTEM_ISSUE_STATUS_META, value);
}

export function isSystemIssueCategory(value: unknown): value is SystemIssueCategory {
  return typeof value === 'string' && Object.hasOwn(SYSTEM_ISSUE_CATEGORY_LABEL, value);
}
