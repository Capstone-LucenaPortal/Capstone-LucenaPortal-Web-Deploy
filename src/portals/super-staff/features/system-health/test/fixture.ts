// The one fixture of the super_system_health() snapshot the page tests share.
// It mirrors l94's shape (../types; the DB pins the same key sets in
// assert_l92–l94 G6) and reads all ok, so each test states only the fault it
// seeds. The check labels are the database's own words; the actions are
// shortened.
import type {
  HealthCheck,
  HealthSample,
  HealthStatus,
  HealthSummary,
  Reachability,
  SectionJob,
  SnapshotSectionKey,
  SystemHealth,
} from "../types";
import { RANK, worse } from "../lib/status";

const MB = 1024 ** 2;
const MiB_500 = 500 * MB;
const GiB = 1024 * MB;

function graded(key: string, label: string, count: number | null, oldest: number | null, action: string): HealthCheck {
  return { key, label, count, oldest_seconds: oldest, status: "ok", action, graded: true };
}

function ungraded(key: string, label: string, count: number, oldest: number | null, action: string): HealthCheck {
  return { key, label, count, oldest_seconds: oldest, status: null, action, graded: false };
}

const REPORT = "Report it to the developer.";

const JOBS: SectionJob[] = [
  {
    name: "purge-cron-history",
    schedule: "17 19 * * *",
    active: true,
    known: true,
    serves: "database",
    proved_by: { section: "jobs", check: "run_history_unpurged" },
    interval_seconds: 86400,
    last_start: "2026-10-30T19:17:00Z",
    last_status: "succeeded",
    last_duration_ms: 310,
    failures_24h: 0,
    overdue: false,
    ran_without_worker: false,
    status: "ok",
  },
  {
    name: "sample-system-health",
    schedule: "*/5 * * * *",
    active: true,
    known: true,
    serves: null,
    proved_by: { section: "jobs", check: "samples_stale" },
    interval_seconds: 300,
    last_start: "2026-10-31T05:55:00Z",
    last_status: "succeeded",
    last_duration_ms: 240,
    failures_24h: 0,
    overdue: false,
    ran_without_worker: false,
    status: "ok",
  },
  {
    name: "sweep-expired-booking-holds",
    schedule: "*/5 * * * *",
    active: true,
    known: true,
    serves: "lcc",
    proved_by: { section: "lcc", check: "expired_hold" },
    interval_seconds: 300,
    last_start: "2026-10-31T05:55:00Z",
    last_status: "succeeded",
    last_duration_ms: 42,
    failures_24h: 0,
    overdue: false,
    ran_without_worker: false,
    status: "ok",
  },
];

const NO_FAILURES = {
  no_destination: 0,
  worker_lost: 0,
  provider_unavailable: 0,
  provider_refused: 0,
  bounce: 0,
  other: 0,
};

export function healthySnapshot(): SystemHealth {
  return {
    generated_at: "2026-10-31T06:00:00Z",
    status: "ok",
    sections: {
      yellow_card: {
        group: "service",
        label: "Yellow Card",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        last_activity_at: "2026-10-31T05:40:00Z",
        checks: [
          graded("deadline_drift", "Running deadlines that disagree with the calendar", 0, null, REPORT),
          graded("clock_broken", "Processing clocks in the wrong state", 0, null, REPORT),
          graded("approved_no_card", "Approved with no card issued", 0, null, REPORT),
          graded("no_receipt", "No Acknowledgement Receipt 5 minutes after submission", 0, null, REPORT),
          graded("deadline_notice_missed", "At Risk or Overdue notice missed by more than 30 minutes", 0, null, REPORT),
          ungraded("abandoned_uploads", "Abandoned document uploads (older than 24 h)", 0, null, "Nothing to do now."),
        ],
        detail: {
          receipts_checked_since: "2026-10-01T00:00:00Z",
          thresholds: { fault_count: 1, receipt_grace_seconds: 300, notice_grace_seconds: 1800, abandoned_upload_seconds: 86400 },
        },
      },
      incidents: {
        group: "service",
        label: "Incidents",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        last_activity_at: "2026-10-31T05:20:00Z",
        checks: [
          graded("photo_not_verified", "Before photo confirmed, report not verified", 0, null, REPORT),
          graded("no_sla_clock", "Verified and routed with no SLA clock", 0, null, REPORT),
          graded("pool_no_responders", "In a pool whose department has no active responder", 0, null, REPORT),
          graded("pool_alerts_unreachable", "In a pool with no responder on duty with a device signed up for alerts", 0, null, REPORT),
          graded("pool_no_pooled_time", "In a pool with no pooled time", 0, null, REPORT),
          graded("no_receipt", "No Acknowledgement Receipt 5 minutes after submission", 0, null, REPORT),
          graded("lifecycle_behind", "Resolved or unverified reports a day past their window", 0, null, REPORT),
          ungraded("abandoned_photos", "Abandoned photo uploads (reservation window passed)", 0, null, "Nothing to do now."),
        ],
        detail: {
          receipts_checked_since: "2026-10-01T00:00:00Z",
          thresholds: { fault_count: 1, receipt_grace_seconds: 300, lifecycle_grace_seconds: 86400 },
        },
      },
      lcc: {
        group: "service",
        label: "LCC Bookings",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        last_activity_at: "2026-10-30T09:15:00Z",
        checks: [
          graded("expired_hold", "Expired holds still blocking the hall after 30 minutes", 0, null, REPORT),
          graded("released_holding_dates", "Cancelled bookings still holding dates", 0, null, REPORT),
          graded("holding_no_dates", "Live bookings holding no dates", 0, null, REPORT),
          graded("no_receipt", "No Acknowledgement Receipt 5 minutes after submission", 0, null, REPORT),
          ungraded("abandoned_documents", "Abandoned document uploads (older than 24 h)", 0, null, "Nothing to do now."),
        ],
        detail: {
          receipts_checked_since: "2026-10-01T00:00:00Z",
          thresholds: { fault_count: 1, receipt_grace_seconds: 300, hold_grace_seconds: 1800, abandoned_upload_seconds: 86400 },
        },
      },
      database: {
        group: "platform",
        label: "Database",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        checks: [
          graded("size", "Database size (% of the 500 MiB limit)", 24, null, "Free space before the limit."),
          graded("connections", "Client connections (% of max_connections)", 23.3, null, "Find and close idle or runaway client connections."),
          graded("cache_hit", "Cache hit ratio (%)", 99.87, null, "Reads are going to disk."),
          graded("oldest_transaction", "Open transactions (age of the oldest)", 1, 2, "Find the session holding the transaction open and end it."),
          graded("lock_waits", "Sessions waiting on a lock over 30 s", 0, null, "End the session holding the lock."),
          ungraded("dead_rows", "Dead rows awaiting vacuum (all tables)", 1840, null, "Nothing to do unless one table keeps growing."),
        ],
        detail: {
          bytes: 120 * MB,
          limit_bytes: MiB_500,
          pct: 24,
          connections: { active: 14, limit: 60, pct: 23.3, by_state: { active: 2, idle: 11, idle_in_transaction: 0, other: 1 } },
          cache: { hit: 998_700, read: 1_300, ratio_pct: 99.87 },
          transactions: { open: 1, oldest_seconds: 2 },
          lock_waits: { waiting: 0, oldest_seconds: null },
          largest_tables: [
            { table: "audit_log", bytes: 38 * MB },
            { table: "notifications", bytes: 21 * MB },
          ],
          dead_rows: [
            { table: "notifications", dead_rows: 1200, live_rows: 48_000, last_autovacuum: "2026-10-31T03:10:00Z" },
            { table: "booking_holds", dead_rows: 640, live_rows: 90, last_autovacuum: null },
          ],
          dead_rows_total: 1840,
          thresholds: {
            database_limit_bytes: MiB_500,
            capacity_warning_pct: 80,
            capacity_critical_pct: 95,
            cache_hit_warning_pct: 99,
            cache_hit_critical_pct: 95,
            transaction_warning_seconds: 300,
            transaction_critical_seconds: 1800,
            lock_wait_seconds: 30,
            lock_waits_warning: 1,
          },
        },
      },
      storage: {
        group: "platform",
        label: "Storage",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        checks: [
          graded("quota", "Storage used (% of the 1 GiB quota)", 29.3, null, "Find the bucket that is growing."),
          ungraded("stray_objects", "Stray files: no row points to them", 3, 172_800, "Nothing to do now."),
          graded("missing_objects", "Missing files: a confirmed upload whose file is gone", 0, null, "Check the bucket in Supabase Storage."),
          graded("seal_missing", "The agency seal has no file", 0, null, "Upload the seal to site-content."),
        ],
        detail: {
          bytes: 300 * MB,
          limit_bytes: GiB,
          pct: 29.3,
          buckets: [
            { bucket: "incident-photos", bytes: 250 * MB, objects: 812, stray_objects: 3, stray_bytes: 2 * MB, missing_objects: 0 },
            { bucket: "yellow-card-documents", bytes: 50 * MB, objects: 96, stray_objects: 0, stray_bytes: 0, missing_objects: 0 },
          ],
          seal_present: true,
          thresholds: {
            storage_limit_bytes: GiB,
            capacity_warning_pct: 80,
            capacity_critical_pct: 95,
            missing_objects_warning: 1,
          },
        },
      },
      notifications: {
        group: "platform",
        label: "Notifications",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        checks: [
          graded("email_worker", "Email worker set up", 0, null, "Not delivering: worker not set up."),
          graded("email_queue", "Oldest queued email", 0, null, "Check the send-email-queue function's logs."),
          graded("email_failures", "Failed or bounced email (24 h)", 0, null, "See the reasons below."),
          ungraded("email_withheld", "Email withheld from an anonymised citizen (24 h)", 1, null, "Nothing to do."),
          graded("push_worker", "Push worker set up", 0, null, "Not delivering: worker not set up."),
          graded("push_queue", "Oldest queued push", 2, 40, "Check the send-push-queue function's logs."),
          graded("push_failures", "Failed or bounced push (24 h)", 0, null, "See the reasons below."),
        ],
        detail: {
          channels: [
            { channel: "email", delivery_enabled: true, queued: 0, sent: 31, failed: 0, bounced: 0, retrying: 0, withheld: 1, mocked: 0, skipped: 0, oldest_queued_seconds: null, failure_reasons: { ...NO_FAILURES } },
            { channel: "push", delivery_enabled: true, queued: 2, sent: 12, failed: 0, bounced: 0, retrying: 1, withheld: 0, mocked: 0, skipped: 0, oldest_queued_seconds: 40, failure_reasons: { ...NO_FAILURES } },
            { channel: "in_app", delivery_enabled: null, queued: 0, sent: 64, failed: 0, bounced: 0, retrying: 0, withheld: 0, mocked: 0, skipped: 0, oldest_queued_seconds: null, failure_reasons: { ...NO_FAILURES } },
          ],
          notes: [
            "SMS is not built: nothing in this system writes an SMS notification.",
            '"Sent" means the provider accepted the message, not that it arrived. Email bounces Brevo reports back are counted as bounced.',
          ],
          thresholds: { queued_warning_seconds: 900, queued_critical_seconds: 3600, delivery_failures_warning: 1 },
        },
      },
      jobs: {
        group: "platform",
        label: "Background jobs",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        checks: [
          graded("failed", "Last run failed", 0, null, "Read the job's latest run."),
          graded("ran_without_worker", "Send job ran with no worker set up", 0, null, "Set up the channel's worker."),
          graded("overdue", "Overdue: no run in twice its interval", 0, null, "Check that pg_cron is running."),
          graded("switched_off", "A system job is switched off", 0, null, "Switch it back on."),
          graded("samples_stale", "History not sampled within twice the sampler's interval", 0, 300, "Read the sampler's latest run."),
          graded("run_history_unpurged", "Job run history kept past 7 days", 0, 590_000, "Read the purge job's latest run."),
        ],
        detail: {
          items: JOBS.map((j) => ({ ...j })),
          run_history_rows: 4210,
          run_history_oldest_seconds: 590_000,
          thresholds: { job_overdue_factor: 2, run_history_keep_seconds: 604_800 },
        },
      },
      accounts: {
        group: "platform",
        label: "Accounts & sign-in",
        own_status: "ok",
        status: "ok",
        affected_by: [],
        checks: [
          ungraded("sign_ins", "Staff sign-ins (24 h)", 17, null, "Nothing to do."),
          graded("recovery_requests", "Staff password-recovery requests (last hour)", 0, null, "Read Supabase Auth's logs."),
          graded("single_super_staff", "Active Super-staff accounts that have signed in", 2, null, "Have a second Super-staff account."),
          ungraded("unaccepted_invitations", "Invitations unaccepted after 7 days", 1, 777_600, "Resend the sign-in link from Accounts."),
          ungraded("departments_without_responders", "Departments with incident types and no active responder", 0, null, "Create or activate a responder."),
        ],
        detail: {
          sign_ins_24h: 17,
          recovery_requests_1h: 0,
          active_super_staff: 2,
          unaccepted_invitations: 1,
          departments_without_responders: 0,
          notes: ["Failed sign-ins are not visible to the database: Supabase Auth never writes them here. See Supabase Logs."],
          thresholds: {
            recovery_window_seconds: 3600,
            recovery_requests_warning: 5,
            super_staff_warning_at_most: 1,
            invitation_age_seconds: 604_800,
          },
        },
      },
    },
    dependencies: {
      yellow_card: ["database", "storage", "notifications", "jobs"],
      incidents: ["database", "storage", "notifications", "jobs", "accounts"],
      lcc: ["database", "storage", "notifications", "jobs"],
      database: [],
      storage: [],
      notifications: [],
      jobs: [],
      accounts: [],
    },
    // l91's keys, still returned beside the sections.
    jobs: {
      status: "ok",
      failed_24h: 0,
      items: JOBS.map((j) => ({
        name: j.name,
        schedule: j.schedule,
        active: j.active,
        interval_seconds: j.interval_seconds,
        last_start: j.last_start,
        last_status: j.last_status,
        last_duration_ms: j.last_duration_ms,
        failures_24h: j.failures_24h,
        overdue: j.overdue,
        status: j.status,
      })),
    },
    delivery: {
      status: "ok",
      channels: [
        { channel: "email", status: "ok", queued: 0, sent: 31, failed: 0, bounced: 0, oldest_queued_seconds: null },
        { channel: "push", status: "ok", queued: 2, sent: 12, failed: 0, bounced: 0, oldest_queued_seconds: 40 },
      ],
    },
    capacity: {
      status: "ok",
      database: { status: "ok", bytes: 120 * MB, limit_bytes: MiB_500, pct: 24 },
      storage: {
        status: "ok",
        bytes: 300 * MB,
        limit_bytes: GiB,
        pct: 29.3,
        buckets: [
          { bucket: "incident-photos", bytes: 250 * MB, objects: 812 },
          { bucket: "yellow-card-documents", bytes: 50 * MB, objects: 96 },
        ],
      },
      connections: { status: "ok", active: 14, limit: 60, pct: 23.3 },
    },
    performance: {
      by_mean: [{ query: "select * from incidents where id = $1", calls: 900, mean_ms: 3.2, total_ms: 2880 }],
      by_calls: [{ query: "select is_active_staff($1)", calls: 5400, mean_ms: 0.4, total_ms: 2160 }],
    },
    sign_ins: { count_24h: 17 },
    thresholds: {
      plan: "Free",
      database_limit_bytes: MiB_500,
      storage_limit_bytes: GiB,
      job_overdue_factor: 2,
      queued_warning_seconds: 900,
      queued_critical_seconds: 3600,
      delivery_failures_warning: 1,
      capacity_warning_pct: 80,
      capacity_critical_pct: 95,
    },
  };
}

/**
 * Rolls the sections up as l94 does: own_status is the worst graded check;
 * status and affected_by come from each dependency's own_status (worst first,
 * then dependency order); the top-level status is the worst section status.
 */
function rollUp(health: SystemHealth): SystemHealth {
  const sections = Object.entries(health.sections) as Array<[SnapshotSectionKey, SystemHealth["sections"][SnapshotSectionKey]]>;
  for (const [, s] of sections) {
    s.own_status = s.checks.reduce<HealthStatus>((w, c) => (c.graded ? worse(w, c.status) : w), "ok");
  }
  for (const [key, s] of sections) {
    const own = (d: SnapshotSectionKey) => health.sections[d].own_status;
    s.affected_by = health.dependencies[key]
      .filter((d) => own(d) !== "ok")
      .sort((a, b) => RANK[own(b)] - RANK[own(a)]);
    s.status = s.affected_by.reduce<HealthStatus>((w, d) => worse(w, own(d)), s.own_status);
  }
  health.status = sections.reduce<HealthStatus>((w, [, s]) => worse(w, s.status), "ok");
  return health;
}

/** Seeds one check's grade, and rolls the sections up as the database would. */
export function withCheck(
  health: SystemHealth,
  section: SnapshotSectionKey,
  key: string,
  status: HealthStatus,
  count?: number,
): SystemHealth {
  const s = health.sections[section];
  s.checks = s.checks.map((c) =>
    c.key === key ? { ...c, graded: true as const, status, count: count ?? c.count } : c,
  );
  return rollUp(health);
}

export const FAST: Reachability = { ok: true, db_ok: true, ms: 120 };

const ALL = (status: HealthStatus | null): HealthSample["sections"] => ({
  yellow_card: status,
  incidents: status,
  lcc: status,
  database: status,
  storage: status,
  notifications: status,
  jobs: status,
  accounts: status,
});

/** Three samples: one taken before l92 (no section statuses), a Database warning, then all ok. */
export const SAMPLES: HealthSample[] = [
  { sampledAt: "2026-10-31T05:45:00Z", status: "ok", sections: ALL(null), connections: 11, emailQueued: 0, pushQueued: 0 },
  { sampledAt: "2026-10-31T05:50:00Z", status: "warning", sections: { ...ALL("ok"), database: "warning" }, connections: 12, emailQueued: 0, pushQueued: 1 },
  { sampledAt: "2026-10-31T05:55:00Z", status: "ok", sections: ALL("ok"), connections: 14, emailQueued: 0, pushQueued: 2 },
];

export const SUMMARY: HealthSummary = { samples7d: 2016, healthyPct7d: 93.3 };
