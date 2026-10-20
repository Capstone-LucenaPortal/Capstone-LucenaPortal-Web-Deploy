'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import ProtectedRoute from '@/portals/citizen/features/auth/components/protected-route';
import type { MyIncident } from '@/portals/citizen/features/incidents/types';
import { getMyIncidents } from '@/portals/citizen/features/incidents/lib/incidents';
import type { MyYellowCardApplication, MyYellowCard } from '@/portals/citizen/features/yellow-card/types';
import { yellowCardService } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import type { MyBooking } from '@/portals/citizen/features/booking/types';
import { getMyBookings } from '@/portals/citizen/features/booking/lib/booking';
import { catalogService, type IncidentConfig } from '@/portals/citizen/lib/supabase/catalogs';
import type { StatusMeta } from '@/portals/citizen/features/dashboard/types';
import { INCIDENT_STATUS_META, YELLOW_CARD_STATUS_META, BOOKING_STATUS_META, computeYellowCardStatus, yellowCardSlaTarget, incidentSlaTarget } from '@/portals/citizen/features/dashboard/lib/status';
import NotificationsPanel from '@/portals/citizen/features/notifications/components/notifications-panel';
import IncidentCardActions from '@/portals/citizen/features/dashboard/components/incident-card-actions';
import IncidentOriginalNote from '@/portals/citizen/features/dashboard/components/incident-original-note';
import BookingCardActions from '@/portals/citizen/features/dashboard/components/booking-card-actions';
import YellowCardActions from '@/portals/citizen/features/dashboard/components/yellow-card-actions';
import { formatClockTime, formatPHP } from '@/portals/citizen/features/booking/lib/schedule';
import { receiptService, receiptReferences } from '@/portals/citizen/features/receipts/lib/receipts';
import { ReceiptLink } from '@/portals/citizen/features/receipts/components/receipt-link';
import { formatManilaDate } from '@/shared/dates/manila';

function statusMetaFor(status: string, table: Record<string, StatusMeta>): StatusMeta {
  return table[status] ?? { label: status, color: '#6B7280', icon: '•' };
}

interface DonutSegment { color: string; count: number; label: string; }

function tallyByLabel(statuses: string[], table: Record<string, StatusMeta>): DonutSegment[] {
  const counts = new Map<string, { color: string; count: number }>();
  for (const status of statuses) {
    const meta = statusMetaFor(status, table);
    const existing = counts.get(meta.label);
    if (existing) existing.count += 1;
    else counts.set(meta.label, { color: meta.color, count: 1 });
  }
  return Array.from(counts.entries()).map(([label, { color, count }]) => ({ label, color, count }));
}

function DonutChart({ segments, total, centerLabel, centerColor }: {
  segments: DonutSegment[];
  total: number;
  centerLabel: string;
  centerColor: string;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const STROKE = 14;
  const SIZE = (r + STROKE) * 2 + 4;
  const cx = SIZE / 2;

  const filled = segments.filter(s => s.count > 0);
  const paths = filled.map(s => {
    const frac = total > 0 ? s.count / total : 0;
    const dash = frac * circ;
    const path = (
      <circle
        key={s.label}
        r={r} cx={cx} cy={cx}
        fill="none"
        stroke={s.color}
        strokeWidth={STROKE}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-offset * circ / (total || 1) * total}
        style={{ transform: `rotate(${(offset / (total || 1)) * 360 - 90}deg)`, transformOrigin: `${cx}px ${cx}px` }}
      />
    );
    offset += s.count;
    return path;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE}>
          <circle r={r} cx={cx} cy={cx} fill="none" stroke="#F0F0F0" strokeWidth={STROKE} />
          {total === 0 ? (
            <circle r={r} cx={cx} cy={cx} fill="none" stroke="#E5E7EB" strokeWidth={STROKE} />
          ) : paths}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: centerColor, lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 10, color: '#666666', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{centerLabel}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center', marginTop: 12 }}>
        {filled.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: '#555' }}>{s.label} ({s.count})</span>
          </div>
        ))}
        {filled.length === 0 && <span style={{ fontSize: 11, color: '#666666' }}>No data yet</span>}
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [dashboardTab, setDashboardTab] = useState<'yellowcard' | 'incident' | 'booking'>('yellowcard');
  const [incidents, setIncidents] = useState<MyIncident[]>([]);
  const [applications, setApplications] = useState<MyYellowCardApplication[]>([]);
  const [cards, setCards] = useState<MyYellowCard[]>([]);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [incidentConfig, setIncidentConfig] = useState<IncidentConfig | null>(null);
  // Which references have an acknowledgement receipt. Submissions made before
  // the receipt layer shipped have none (DB ADR 0001), so the link is rendered
  // per row rather than on every row.
  const [receiptRefs, setReceiptRefs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Bumped by any self-service action that changes server state, so the cards
  // re-read rather than showing what the citizen just acted on.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMyIncidents().catch(() => []),
      yellowCardService.getMyApplications().catch(() => []),
      yellowCardService.getMyCards().catch(() => []),
      getMyBookings().catch(() => []),
      // The auto-close/confirmation deadlines shown on incident cards come from
      // the config view, not from a hardcoded day count that would drift.
      catalogService.getIncidentConfig().catch(() => null),
      receiptService.getMine().catch(() => []),
    ]).then(([i, a, c, b, cfg, receipts]) => {
      if (cancelled) return;
      setIncidents(i);
      setApplications(a);
      setCards(c);
      setBookings(b);
      setIncidentConfig(cfg);
      setReceiptRefs(receiptReferences(receipts));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const totalRequests = incidents.length + applications.length + bookings.length;
  const ycStatus = computeYellowCardStatus(applications, cards);

  const statCardStyle: React.CSSProperties = {
    background: 'white', border: '1px solid #DDDDDD', borderRadius: 8,
    padding: '28px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
    background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', transition: 'all 0.2s',
    borderBottom: active ? '3px solid #003DA5' : '3px solid transparent',
    color: active ? '#003DA5' : '#666666',
  });

  if (loading) {
    return (
      <section style={{ padding: '48px clamp(20px, 5vw, 48px) 80px', maxWidth: 1400, margin: '0 auto' }}>
        <p style={{ fontSize: 15, color: '#666666' }}>Loading your dashboard…</p>
      </section>
    );
  }

  return (
    <section style={{ padding: '48px clamp(20px, 5vw, 48px) 80px', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>My Dashboard</h1>
      <p style={{ fontSize: 15, color: '#666666', marginBottom: 40 }}>Welcome, {user?.name}. Track your applications and requests.</p>

      <NotificationsPanel onNavigate={(section) => {
        if (section === 'incidents') setDashboardTab('incident');
        else if (section === 'yellowCards') setDashboardTab('yellowcard');
        else setDashboardTab('booking');
      }} />

      {/* Stat Cards with Donut Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 40 }}>
        {/* Total Requests */}
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: '#666666', marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total Requests</div>
          <DonutChart
            total={totalRequests}
            centerLabel="Total"
            centerColor="#003DA5"
            segments={[
              { color: '#FCD34D', count: applications.length, label: 'Yellow Card' },
              { color: '#F97316', count: incidents.length, label: 'Incident' },
              { color: '#3B82F6', count: bookings.length, label: 'Bookings' },
            ]}
          />
        </div>

        {/* Yellow Card Status */}
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: '#666666', marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Yellow Card Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 190 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{ycStatus.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: ycStatus.color, marginBottom: 6 }}>{ycStatus.label}</div>
            {ycStatus.ref && (
              <>
                <div style={{ fontSize: 12, color: '#666666' }}>{ycStatus.label === 'Card Active' ? 'Card #' : 'ARN'} {ycStatus.ref}</div>
                {ycStatus.date && (
                  <div style={{ fontSize: 11, color: '#666666', marginTop: 2 }}>{ycStatus.dateLabel}: {formatManilaDate(ycStatus.date)}</div>
                )}
                {ycStatus.reason && (
                  <div style={{ fontSize: 11, color: '#666666', marginTop: 8, textAlign: 'center', maxWidth: 200 }}>{ycStatus.reason}</div>
                )}
                {ycStatus.label === 'Rejected' && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 8, fontWeight: 600, textAlign: 'center' }}>
                    You may submit a new application
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Incident Reports */}
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: '#666666', marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Incident Reports</div>
          <DonutChart
            total={incidents.length}
            centerLabel="Reports"
            centerColor="#EA580C"
            segments={tallyByLabel(incidents.map(i => i.status), INCIDENT_STATUS_META)}
          />
        </div>

        {/* Venue Bookings */}
        <div style={statCardStyle}>
          <div style={{ fontSize: 12, color: '#666666', marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Venue Bookings</div>
          <DonutChart
            total={bookings.length}
            centerLabel="Bookings"
            centerColor="#2563EB"
            segments={tallyByLabel(bookings.map(b => b.status), BOOKING_STATUS_META)}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #DDDDDD', marginBottom: 32 }}>
        <button style={tabBtnStyle(dashboardTab === 'yellowcard')} onClick={() => setDashboardTab('yellowcard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, marginBottom: 2 }}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>
          </svg>
          Yellow Card ({applications.length})
        </button>
        <button style={tabBtnStyle(dashboardTab === 'incident')} onClick={() => setDashboardTab('incident')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, marginBottom: 2 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Incident Reports ({incidents.length})
        </button>
        <button style={tabBtnStyle(dashboardTab === 'booking')} onClick={() => setDashboardTab('booking')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, marginBottom: 2 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Venue Bookings ({bookings.length})
        </button>
      </div>

      {/* Yellow Card Tab */}
      {dashboardTab === 'yellowcard' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Yellow Card Applications</h2>
          {applications.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #DDDDDD', borderRadius: 8, padding: '64px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 16px' }}>
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>
              </svg>
              <p style={{ fontSize: 15, color: '#666666', marginBottom: 24 }}>No Yellow Card applications yet.</p>
              <button
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FDB913', color: 'black', border: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => router.push('/yellow-card')}
              >Apply Now</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {applications.map(app => {
                const meta = statusMetaFor(app.status, YELLOW_CARD_STATUS_META);
                const showReason = app.status === 'revision_requested' || app.status === 'rejected';
                // Null once a decision lands, or while a revision pauses the
                // clock. `due_at` survives on decided rows, so the date alone
                // cannot answer this — see `yellowCardSlaTarget`.
                const slaTarget = yellowCardSlaTarget(app);
                return (
                  <div key={app.id} style={{ background: 'white', border: '1px solid #DDDDDD', borderLeft: `4px solid ${meta.color}`, borderRadius: 8, padding: '20px 24px 20px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#003DA5', marginBottom: 6 }}>Application #{app.reference_number}</h3>
                        {receiptRefs.has(app.reference_number) && (
                          <p style={{ marginBottom: 6 }}><ReceiptLink reference={app.reference_number} /></p>
                        )}
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 10 }}>Submitted: {formatManilaDate(app.submitted_at)}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                          <span style={{ fontSize: 18 }}>{meta.icon}</span>
                          <span style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                        {showReason && app.current_reason && (
                          <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 4, padding: 12, marginTop: 12 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#9A3412', marginBottom: 4 }}>Reviewer&#39;s note</p>
                            <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.5 }}>{app.current_reason}</p>
                          </div>
                        )}
                        {app.status === 'revision_requested' && (
                          <button
                            onClick={() => router.push(`/yellow-card/${app.id}/revise`)}
                            style={{ marginTop: 12, background: '#F97316', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Revise &amp; Resubmit
                          </button>
                        )}
                        <YellowCardActions application={app} onChanged={refresh} />
                      </div>
                      {slaTarget && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>SLA Target</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#003DA5' }}>{formatManilaDate(slaTarget)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Incident Reports Tab */}
      {dashboardTab === 'incident' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Incident Reports</h2>
          {incidents.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #DDDDDD', borderRadius: 8, padding: '64px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 16px' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p style={{ fontSize: 15, color: '#666666', marginBottom: 24 }}>No incident reports yet.</p>
              <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#003DA5', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/incident')}>Report an Incident</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {incidents.map(inc => {
                const meta = statusMetaFor(inc.status, INCIDENT_STATUS_META);
                const slaDue = incidentSlaTarget(inc);
                return (
                  <div key={inc.id} style={{ background: 'white', border: '1px solid #DDDDDD', borderLeft: `4px solid ${meta.color}`, borderRadius: 8, padding: '20px 24px 20px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
                      <div>
                        {/* The INC- prefix already says what this is, so no label in
                            front of it — and never "Ticket #" (CONTEXT.md). */}
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#003DA5', marginBottom: 6 }}>{inc.reference_number}</h3>
                        {receiptRefs.has(inc.reference_number) && (
                          <p style={{ marginBottom: 6 }}><ReceiptLink reference={inc.reference_number} /></p>
                        )}
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>Type: <strong>{inc.type_label}</strong></p>
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>{inc.address}, {inc.barangay_name}</p>
                        {inc.assigned_department_label && (
                          <p style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>Department: <strong>{inc.assigned_department_label}</strong></p>
                        )}
                        <IncidentOriginalNote originalReference={inc.original_reference} />
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 10 }}>Submitted: {formatManilaDate(inc.submitted_at)}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                          <span style={{ fontSize: 18 }}>{meta.icon}</span>
                          <span style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                        <IncidentCardActions incident={inc} config={incidentConfig} onChanged={refresh} />
                      </div>
                      {slaDue && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>SLA Due</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#003DA5' }}>{formatManilaDate(slaDue)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Venue Bookings Tab */}
      {dashboardTab === 'booking' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Venue Bookings</h2>
          {bookings.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #DDDDDD', borderRadius: 8, padding: '64px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 16px' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <p style={{ fontSize: 15, color: '#666666', marginBottom: 24 }}>No venue bookings yet.</p>
              <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#3B82F6', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/lcc')}>Book a Venue</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {bookings.map(bk => {
                const meta = statusMetaFor(bk.status, BOOKING_STATUS_META);
                return (
                  <div key={bk.id} style={{ background: 'white', border: '1px solid #DDDDDD', borderLeft: `4px solid ${meta.color}`, borderRadius: 8, padding: '20px 24px 20px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#003DA5', marginBottom: 6 }}>Booking #{bk.reference_number}</h3>
                        {receiptRefs.has(bk.reference_number) && (
                          <p style={{ marginBottom: 6 }}><ReceiptLink reference={bk.reference_number} /></p>
                        )}
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>Event: <strong>{bk.event_title}</strong></p>
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>Venue: <strong>{bk.venue_label}</strong></p>
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>Date: <strong>{formatManilaDate(bk.event_date)}</strong> at {formatClockTime(bk.start_time)}</p>
                        <p style={{ fontSize: 13, color: '#666666', marginBottom: 10 }}>Submitted: {formatManilaDate(bk.submitted_at)}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                          <span style={{ fontSize: 18 }}>{meta.icon}</span>
                          <span style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                        <BookingCardActions booking={bk} onChanged={refresh} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>Total Fee</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#003DA5' }}>{bk.total_fee != null ? formatPHP(bk.total_fee) : 'Awaiting Quote'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
