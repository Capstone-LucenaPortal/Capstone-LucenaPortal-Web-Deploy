"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/portals/staff/lib/utils";
import { arrivalLabel, newArrivals } from "./queue-activity";

/**
 * How often to ask whether anything arrived.
 *
 * Thirty seconds is a compromise: fast enough that a clerk notices an arrival
 * within a normal pause between records, slow enough that a room of staff with
 * a queue open all day is a trivial load on the view.
 */
const POLL_INTERVAL_MS = 30_000;

interface QueueActivityBarProps {
  /** The backlog figure the server last rendered, and the arrival baseline. */
  count: number;
  /**
   * The owning module's poll. A Server Action, handed in from the module's
   * queue component rather than imported here — one bar, three actions, so no
   * single `"use server"` endpoint ends up choosing a module from an argument
   * that arrived over the wire. See ADR-0002.
   *
   * Free to be an inline closure: it is read through a ref, so its identity
   * never restarts the timer. See the poll effect below.
   */
  countAction: () => Promise<number | null>;
  /** What this queue calls its arrivals: "new", "more waiting". */
  noun: string;
}

/**
 * Tells a member of staff that the queue has moved on without them, and lets
 * them pull the new state in when they are ready.
 *
 * Deliberately does NOT auto-refresh. Re-rendering the table under someone who
 * is reading a row is worse than a slightly stale table; the decision to
 * refresh stays theirs.
 */
export function QueueActivityBar({ count, countAction, noun }: QueueActivityBarProps) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(count);
  const [current, setCurrent] = useState(count);
  const [isRefreshing, startRefresh] = useTransition();

  // The timer is set up once and must stay that way. Depending on the action
  // directly would mean a caller passing an inline arrow — a fresh function
  // every render — tears the interval down and rebuilds it before thirty
  // seconds are ever up, so the poll silently never fires. Reading it through
  // a ref keeps the timer stable without pinning the call to a stale closure.
  const poll = useRef(countAction);
  useEffect(() => {
    poll.current = countAction;
  }, [countAction]);

  // Re-sync to whatever the server last rendered. This fires for the refresh
  // button, but also for a decision's revalidatePath() and any other re-render
  // — so the badge clears itself without any of them knowing it exists.
  useEffect(() => {
    setBaseline(count);
    setCurrent(count);
  }, [count]);

  useEffect(() => {
    let cancelled = false;

    const id = setInterval(async () => {
      // A background tab has no reader to inform. Skip the request entirely
      // rather than counting rows nobody is looking at.
      if (document.hidden) return;

      const next = await poll.current();

      // null means the read failed. Keep the last known figure: a blip must
      // not silently retract a badge a member of staff has already seen.
      if (!cancelled && next !== null) setCurrent(next);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const label = arrivalLabel(newArrivals(baseline, current), noun);

  return (
    <div className="flex items-center gap-3">
      {/*
        Always in the DOM, empty when there is nothing to say. A live region
        added to the page at the moment it gains content is not reliably
        announced; one that is already there is.
      */}
      <span aria-live="polite" className="text-sm font-medium text-lucena-blue">
        {label}
      </span>

      <button
        type="button"
        onClick={() => startRefresh(() => router.refresh())}
        disabled={isRefreshing}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue disabled:opacity-50"
      >
        <RefreshCw
          className={cn("h-4 w-4 shrink-0", isRefreshing && "animate-spin")}
          aria-hidden="true"
        />
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
