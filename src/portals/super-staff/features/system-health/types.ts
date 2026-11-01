// Domain types for System Health (#72, ADR 0008): whether the software itself
// is working. Service performance (SLA, backlog) is Admin's; see
// ../monitoring for the four tiles shown here as Service impact.
import type { Database } from "@/shared/supabase/types";

export type HealthStatus = Database["public"]["Enums"]["system_health_status"];

export type Statement = {
  query: string; // ≤120 chars of normalised text, constants as $1, $2 …
  calls: number;
  mean_ms: number;
  total_ms: number;
};

/** A section of the snapshot, by its database key. */
export type SnapshotSectionKey =
  | "yellow_card"
  | "incidents"
  | "lcc"
  | "database"
  | "storage"
  | "notifications"
  | "jobs"
  | "accounts";

/**
 * One named check (l92). An ungraded check is information only: it carries no
 * status, and the page gives it no colour.
 */
export type HealthCheck = {
  key: string;
  label: string;
  /**
   * Usually a count. On the capacity and cache checks it is a percentage, and
   * the label says so; `null` when there is nothing to measure yet (a cache
   * that has served no reads).
   */
  count: number | null;
  /** The age of the oldest item counted; null = none, or no age applies. */
  oldest_seconds: number | null;
  /** What the officer should do, in the database's words. */
  action: string;
} & ({ graded: true; status: HealthStatus } | { graded: false; status: null });

type Section<Group extends "service" | "platform", Detail> = {
  group: Group;
  label: string;
  /** The worst of the section's own graded checks. */
  own_status: HealthStatus;
  /** The worse of `own_status` and each dependency's `own_status`. */
  status: HealthStatus;
  /** The dependencies that are not ok, worst first. Always empty for a Platform section. */
  affected_by: SnapshotSectionKey[];
  checks: HealthCheck[];
  detail: Detail;
};

type ServiceSection<Thresholds> = Section<
  "service",
  {
    /** The first receipt ever issued: submissions before it are not checked for one. null = none yet. */
    receipts_checked_since: string | null;
    thresholds: { fault_count: number; receipt_grace_seconds: number } & Thresholds;
  }
> & {
  /** The latest submission; null = none ever. */
  last_activity_at: string | null;
};

export type ServiceSections = {
  yellow_card: ServiceSection<{ notice_grace_seconds: number; abandoned_upload_seconds: number }>;
  incidents: ServiceSection<{ lifecycle_grace_seconds: number }>;
  lcc: ServiceSection<{ hold_grace_seconds: number; abandoned_upload_seconds: number }>;
};

export type FailureReason =
  | "no_destination"
  | "worker_lost"
  | "provider_unavailable"
  | "provider_refused"
  | "bounce"
  | "other";

/** One channel's delivery over 24 h (l92). Counts only, never a recipient. */
export type ChannelDelivery = {
  channel: "email" | "push" | "in_app";
  /** The delivery switch; null for in-app, which has no worker. */
  delivery_enabled: boolean | null;
  queued: number;
  sent: number;
  failed: number;
  bounced: number;
  /** Still queued after at least one attempt. */
  retrying: number;
  /** Skipped because the citizen is anonymised. */
  withheld: number;
  /** Marked sent by a worker that is not set up. */
  mocked: number;
  skipped: number;
  /** Any age; null = nothing queued. */
  oldest_queued_seconds: number | null;
  failure_reasons: Record<FailureReason, number>;
};

export type SectionJob = HealthJob & {
  /** One of the jobs this schema schedules. Only a known job is graded for being switched off. */
  known: boolean;
  /** The section the job's work is for; null = System Health's own sampler. */
  serves: SnapshotSectionKey | null;
  /** The check that shows the job did its work; null for a job this schema does not schedule. */
  proved_by: { section: SnapshotSectionKey; check: string } | null;
  /** A send job that ran with its channel's worker not set up. */
  ran_without_worker: boolean;
};

export type PlatformSections = {
  database: Section<
    "platform",
    {
      bytes: number;
      limit_bytes: number;
      pct: number;
      connections: {
        active: number;
        limit: number;
        pct: number;
        by_state: { active: number; idle: number; idle_in_transaction: number; other: number };
      };
      /** `ratio_pct` is null until the cache has served a read. */
      cache: { hit: number; read: number; ratio_pct: number | null };
      transactions: { open: number; oldest_seconds: number | null };
      /** Sessions waiting on a lock for longer than `thresholds.lock_wait_seconds`. */
      lock_waits: { waiting: number; oldest_seconds: number | null };
      /** At most five, largest first. */
      largest_tables: Array<{ table: string; bytes: number }>;
      /** At most five, most dead rows first. */
      dead_rows: Array<{ table: string; dead_rows: number; live_rows: number; last_autovacuum: string | null }>;
      dead_rows_total: number;
      thresholds: {
        database_limit_bytes: number;
        capacity_warning_pct: number;
        capacity_critical_pct: number;
        cache_hit_warning_pct: number;
        cache_hit_critical_pct: number;
        transaction_warning_seconds: number;
        transaction_critical_seconds: number;
        lock_wait_seconds: number;
        lock_waits_warning: number;
      };
    }
  >;
  storage: Section<
    "platform",
    {
      bytes: number;
      limit_bytes: number;
      pct: number;
      buckets: Array<{
        bucket: string;
        bytes: number;
        objects: number;
        /** Files no row points to. */
        stray_objects: number;
        stray_bytes: number;
        /** Confirmed uploads whose file is gone. */
        missing_objects: number;
      }>;
      seal_present: boolean;
      thresholds: {
        storage_limit_bytes: number;
        capacity_warning_pct: number;
        capacity_critical_pct: number;
        missing_objects_warning: number;
      };
    }
  >;
  notifications: Section<
    "platform",
    {
      /** Always email, push and in-app, in that order. */
      channels: ChannelDelivery[];
      /** Fixed lines the page shows as written. */
      notes: string[];
      thresholds: {
        queued_warning_seconds: number;
        queued_critical_seconds: number;
        delivery_failures_warning: number;
      };
    }
  >;
  jobs: Section<
    "platform",
    {
      items: SectionJob[];
      /** Rows in pg_cron's run history, which the purge-cron-history job keeps to 7 days. */
      run_history_rows: number;
      run_history_oldest_seconds: number | null;
      thresholds: { job_overdue_factor: number; run_history_keep_seconds: number };
    }
  >;
  accounts: Section<
    "platform",
    {
      sign_ins_24h: number;
      recovery_requests_1h: number;
      active_super_staff: number;
      unaccepted_invitations: number;
      departments_without_responders: number;
      notes: string[];
      thresholds: {
        recovery_window_seconds: number;
        recovery_requests_warning: number;
        super_staff_warning_at_most: number;
        invitation_age_seconds: number;
      };
    }
  >;
};

/**
 * What `super_system_health()` returns. The generated type is bare `Json`, so
 * the shape is declared here; the DB's static asserts (assert_l92–l94 G6) fail
 * if a key is added or removed. Every `status` is graded by the database and
 * is authoritative: the page displays it and never recomputes it.
 */
export type SystemHealth = {
  generated_at: string;
  /** Overall: the worst of every section's `status`. */
  status: HealthStatus;
  /** Since l92: one section per Citizen service and Platform component. */
  sections: ServiceSections & PlatformSections;
  /** What each section leans on. Platform sections depend on nothing. */
  dependencies: Record<SnapshotSectionKey, SnapshotSectionKey[]>;
  jobs: {
    status: HealthStatus;
    failed_24h: number;
    items: Array<{
      name: string;
      schedule: string;
      /** An inactive job reads `ok` and `overdue: false` by design. */
      active: boolean;
      /** null = the schedule is not readable as a simple interval. */
      interval_seconds: number | null;
      /** null = never ran. */
      last_start: string | null;
      /** pg_cron's own word: 'succeeded' | 'failed' | 'running' | … */
      last_status: string | null;
      last_duration_ms: number | null;
      failures_24h: number;
      overdue: boolean;
      status: HealthStatus;
    }>;
  };
  delivery: {
    status: HealthStatus;
    /** Always exactly email and push. Counts are rows created in the last 24 h. */
    channels: Array<{
      channel: "email" | "push";
      status: HealthStatus;
      queued: number;
      sent: number;
      failed: number;
      bounced: number;
      /** Any age; null = nothing queued. */
      oldest_queued_seconds: number | null;
    }>;
  };
  capacity: {
    status: HealthStatus;
    database: { status: HealthStatus; bytes: number; limit_bytes: number; pct: number };
    storage: {
      status: HealthStatus;
      bytes: number;
      limit_bytes: number;
      pct: number;
      buckets: Array<{ bucket: string; bytes: number; objects: number }>;
    };
    /** `active` counts every open client connection, idle ones included. */
    connections: { status: HealthStatus; active: number; limit: number; pct: number };
  };
  /** No status: the ticket gave it no threshold. */
  performance: { by_mean: Statement[]; by_calls: Statement[] };
  /** No status. */
  sign_ins: { count_24h: number };
  thresholds: {
    plan: string;
    database_limit_bytes: number;
    storage_limit_bytes: number;
    job_overdue_factor: number;
    queued_warning_seconds: number;
    queued_critical_seconds: number;
    delivery_failures_warning: number;
    capacity_warning_pct: number;
    capacity_critical_pct: number;
  };
};

export type HealthJob = SystemHealth["jobs"]["items"][number];

/** What GET /api/health answers, and nothing more. */
export type Reachability = { ok: boolean; db_ok: boolean; ms: number };

export type HealthSample = {
  sampledAt: string;
  status: HealthStatus | null;
  /** Each section's rolled-up status; null on a sample taken before l92. */
  sections: Record<SnapshotSectionKey, HealthStatus | null>;
  connections: number | null;
  emailQueued: number | null;
  pushQueued: number | null;
};

/** `healthyPct7d` is null when there are no samples, e.g. right after deploy. */
export type HealthSummary = {
  samples7d: number | null;
  healthyPct7d: number | null;
};
