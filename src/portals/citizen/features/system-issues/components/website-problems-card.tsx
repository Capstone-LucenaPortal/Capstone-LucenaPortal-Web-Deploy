'use client';

import { formatManilaDate } from '@/shared/dates/manila';
import type { MySystemIssue } from '@/portals/citizen/features/system-issues/types';
import {
  SYSTEM_ISSUE_CATEGORY_LABEL,
  SYSTEM_ISSUE_CLOSE_REASON_LABEL,
  SYSTEM_ISSUE_STATUS_META,
} from '@/portals/citizen/features/system-issues/lib/labels';

/**
 * "Website problems you reported": the Citizen's System issues on the
 * Dashboard (SCRUM-264, #187). Read-only, with no reopen and no actions.
 * Renders nothing when there are none.
 *
 * Every status is the database's derived one (`my_system_issues.status`): a
 * resolved issue reads Closed once its 7 days are up, and this card never
 * works that out from the dates.
 */
export default function WebsiteProblemsCard({ issues }: { issues: MySystemIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div style={{ background: 'white', border: '1px solid #DDDDDD', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginTop: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', padding: '16px 24px', borderBottom: '1px solid #EEEEEE' }}>
        Website problems you reported
      </h2>
      <ul>
        {issues.map((issue, index) => {
          const { label, background, color } = SYSTEM_ISSUE_STATUS_META[issue.status];
          return (
            <li key={issue.id} style={{ padding: '14px 24px', borderTop: index === 0 ? 'none' : '1px solid #EEEEEE', fontSize: 13 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 600, color: '#333333' }}>
                  {SYSTEM_ISSUE_CATEGORY_LABEL[issue.category]}{' '}
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 400, color: '#666666' }}>{issue.referenceNumber}</span>
                </span>
                <span style={{ background, color, borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                  {label}
                </span>
              </div>
              <p style={{ marginTop: 4, color: '#666666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {issue.description}
              </p>
              {issue.resolutionNote && (
                <p style={{ marginTop: 6, background: '#F0FDF4', color: '#14532D', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>
                  Fixed: {issue.resolutionNote}
                  {issue.status === 'resolved' && issue.closesAt && (
                    <> · Closes by itself on {formatManilaDate(issue.closesAt)}</>
                  )}
                </p>
              )}
              {issue.closeReason && (
                <p style={{ marginTop: 6, background: '#F3F4F6', color: '#1F2937', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>
                  {SYSTEM_ISSUE_CLOSE_REASON_LABEL[issue.closeReason]}: {issue.closeNote}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
