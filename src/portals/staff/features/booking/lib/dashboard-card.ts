import { createClient } from "@/shared/supabase/server";
import { NEEDS_ACTION_STATUSES } from "./status";
import type { BookingCardData, PreviewItem } from "@/portals/staff/features/dashboard/types";
import type { BookingStatus } from "../types";

const PREVIEW_LIMIT = 2;

/** Hours after which an unanswered quote request reads as overdue. */
const QUOTE_STALE_HOURS = 24;

export type BookingPreviewRow = {
  id: string;
  reference_number: string | null;
  event_title: string | null;
  status: BookingStatus;
  submitted_at: string | null;
};

const STATUS_TAG: Record<string, { text: string; tone: PreviewItem["tag"]["tone"] }> =
  {
    awaiting_tier_review: { text: "review tier claim", tone: "warning" },
    awaiting_quote: { text: "needs quote", tone: "warning" },
    payment_verification: { text: "verify payment", tone: "high" },
    confirmed: { text: "balance due", tone: "neutral" },
  };

/**
 * Pure. Totals are passed in rather than derived from `rows`, because `rows` is
 * only the first few — counting them would silently cap the figures at the
 * preview limit.
 *
 * The preview is worst-first, and "worst" means longest-waiting: decision 8's
 * whole point is that slow quoting has to be visible as a staff problem rather
 * than something resolved by dropping the citizen's reservation. So an
 * awaiting_quote booking that has been sitting for a day is tagged as overdue
 * rather than merely listed.
 */
export function buildBookingCard({
  awaitingQuote,
  paymentVerification,
  balanceOutstanding,
  rows,
  now,
}: {
  awaitingQuote: number;
  paymentVerification: number;
  balanceOutstanding: number;
  /** Needs-action rows, oldest first. */
  rows: BookingPreviewRow[];
  now: Date;
}): BookingCardData {
  return {
    module: "booking",
    awaitingQuote,
    paymentVerification,
    balanceOutstanding,
    preview: rows.slice(0, PREVIEW_LIMIT).map((row) => {
      const waitedHours = row.submitted_at
        ? (now.getTime() - new Date(row.submitted_at).getTime()) / 3_600_000
        : 0;
      const overdueQuote =
        row.status === "awaiting_quote" && waitedHours > QUOTE_STALE_HOURS;

      return {
        id: row.id,
        label:
          row.event_title ?? row.reference_number ?? "Untitled booking",
        tag: overdueQuote
          ? { text: "quote overdue", tone: "critical" as const }
          : (STATUS_TAG[row.status] ?? { text: row.status, tone: "neutral" as const }),
      };
    }),
  };
}

/**
 * Server-only glue. Two head-only counts, one count of confirmed bookings with
 * money still owed, and one ordered preview page.
 *
 * ⚠️ `balanceOutstanding` here is a COUNT, unlike the queue page's peso total
 * of the same name. See the comment on BookingCardData.
 */
export async function getBookingCard(): Promise<BookingCardData> {
  const supabase = await createClient();
  const now = new Date();

  const [previewResult, quoteResult, verifyResult, balanceResult] =
    await Promise.all([
      supabase
        .from("staff_bookings")
        .select("id, reference_number, event_title, status, submitted_at")
        .in("status", NEEDS_ACTION_STATUSES)
        // Oldest first — how long somebody has been waiting on us.
        .order("submitted_at", { ascending: true })
        .limit(PREVIEW_LIMIT),
      supabase
        .from("staff_bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "awaiting_quote"),
      supabase
        .from("staff_bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "payment_verification"),
      supabase
        .from("staff_bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gt("balance_amount", 0),
    ]);

  if (previewResult.error) {
    throw new Error(
      `booking dashboard read failed: ${previewResult.error.message}`,
    );
  }

  return buildBookingCard({
    awaitingQuote: quoteResult.count ?? 0,
    paymentVerification: verifyResult.count ?? 0,
    balanceOutstanding: balanceResult.count ?? 0,
    rows: (previewResult.data as BookingPreviewRow[] | null) ?? [],
    now,
  });
}
