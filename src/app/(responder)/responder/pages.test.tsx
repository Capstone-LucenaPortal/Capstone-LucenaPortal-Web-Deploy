import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionProvider } from "@/portals/responder/features/auth/hooks/use-session";
import { toResponderUser } from "@/portals/responder/features/auth/lib/responder-user";
import { ToastProvider } from "@/portals/responder/components/ui/toast";
import { PhoneAlertsProvider } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";
import PoolPage from "@/app/(responder)/responder/(portal)/pool/page";
import MyTicketPage from "@/app/(responder)/responder/(portal)/my-ticket/page";
import HistoryPage from "@/app/(responder)/responder/(portal)/history/page";
import NotificationsPage from "@/app/(responder)/responder/(portal)/notifications/page";
import ProfilePage from "@/app/(responder)/responder/(portal)/profile/page";
import {
  aHistoryRow,
  aNotification,
  anEvent,
  anIncident,
} from "@/portals/responder/features/incidents/lib/fixtures";
import type { Incident } from "@/portals/responder/features/incidents/types";

/**
 * ⚠️ THE ONE SEAM IS FAKED, NOT THE SUPABASE CLIENT.
 *
 * Every page here reads through `lib/data.ts`, so that is what these tests
 * replace. The rejected alternative was faking the client itself, which means
 * asserting on query-builder chains: tests that break when a column is
 * reordered and pass when the view is wrong.
 */
const db = vi.hoisted(() => ({
  pool: [] as unknown[],
  held: null as unknown,
  incident: null as unknown,
  events: [] as unknown[],
  photos: [] as unknown[],
  history: [] as unknown[],
  notifications: [] as unknown[],
  unread: 0,
  config: {} as Record<string, number>,
}));

vi.mock("@/portals/responder/features/incidents/lib/data", () => ({
  getPool: async () => db.pool,
  getHeldTicket: async () => db.held,
  getIncident: async () => db.incident,
  getTimeline: async () => db.events,
  getPhotos: async () => db.photos,
  getPhotoUrl: async () => null,
  getHistory: async () => db.history,
  getNotifications: async () => db.notifications,
  getUnreadCount: async () => db.unread,
  getIncidentConfig: async () => db.config,
}));

/**
 * Only getMyProfileRow is mocked for auth. Both the gate and the mapper derive
 * from that one row, so faking the row exercises the real code — where mocking
 * getCurrentResponder would let the two drift and pass on a combination the
 * database cannot produce.
 */
const PROFILE_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "responder" as const,
  status: "active",
  department_code: "engineering",
  department_label: "Engineering",
  phone: "09171234501",
  employee_id: "LGU-2026-0501",
  on_duty: true,
  created_at: "2026-01-12T08:00:00.000Z",
};

vi.mock("@/portals/responder/features/auth/lib/profile", () => ({
  getMyProfileRow: async () => PROFILE_ROW,
}));

// The one server action a render calls by itself (from an effect); the rest
// stay real, since nothing here submits a form.
const markArrivalRead = vi.hoisted(() => vi.fn());
vi.mock("@/portals/responder/features/incidents/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/portals/responder/features/incidents/actions")>()),
  markArrivalRead: async (id: string) => markArrivalRead(id),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

/**
 * ⚠️ THE PAGES READ THE WALL CLOCK, SO THIS FILE PINS IT.
 *
 * Everything beneath a page takes `now` as an argument — the convention
 * `sla.ts` states outright — but a page component is where that instant is
 * *created*, and Next gives no way to pass one in: its generated route
 * validator rejects any prop beyond `params`/`searchParams`, so an extra
 * `now?` would fail `next build`.
 *
 * So the test controls the root instead, faking Date and nothing else.
 * Leaving timers real would make every assertion below an assertion about the
 * day the suite happens to run on — which is exactly how the `/pool?report=`
 * banner rotted: it passed the day it was written and failed every day after
 * the fixture's promise came due.
 *
 * NOW is 8m into the fixture's 4h promise, matching the instant the component
 * tests already use, so page and component agree on what the clock reads.
 */
const NOW = new Date("2026-08-12T00:08:00.000Z");
const ARMED = "2026-08-12T00:00:00.000Z";

const sinkhole = (over: Partial<Incident> = {}) =>
  anIncident({
    id: "inc-4501",
    type_label: "Sinkhole",
    description: "Deep sinkhole formed after last night's heavy rains.",
    reference_number: "INC-2026-000076",
    sla_armed_at: ARMED,
    sla_due_at: "2026-08-12T04:00:00.000Z",
    submitted_at: ARMED,
    ...over,
  });

beforeEach(() => {
  markArrivalRead.mockReset();

  // `toFake` is deliberately narrow: faking setTimeout too would hand React's
  // scheduler a clock nothing advances.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);

  db.pool = [sinkhole(), anIncident({ id: "inc-4487", type_label: "Flooding" })];
  db.held = null;
  db.incident = null;
  db.events = [];
  db.photos = [];
  db.history = [];
  db.notifications = [];
  db.unread = 0;
  db.config = { max_photos_per_cycle: 3, auto_close_day: 7 };
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Smoke tests: each route renders without crashing. These assert copy, not
 * styling, so restyling does not turn them red.
 */
function withProviders(ui: React.ReactNode, row = PROFILE_ROW) {
  return render(
    // ToastProvider on the OUTSIDE, matching the real layout: SessionProvider
    // calls useToast() and cannot consume a context it is nested outside of.
    <ToastProvider>
      <SessionProvider
        responder={toResponderUser(row)!}
        duty={{ onDuty: 1, total: 2 }}
      >
        <PhoneAlertsProvider>{ui}</PhoneAlertsProvider>
      </SessionProvider>
    </ToastProvider>,
  );
}

describe("portal pages", () => {
  it("/responder/pool lists the department pool", async () => {
    withProviders(await PoolPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("2 waiting in pool")).toBeInTheDocument();
    expect(screen.getByText("Sinkhole")).toBeInTheDocument();
    expect(screen.getByText("Verified · SLA running")).toBeInTheDocument();
    // The barangay filter is not built yet; an enabled button that does
    // nothing would be worse than a disabled one.
    expect(screen.getByRole("button", { name: /barangay/i })).toBeDisabled();
  });

  it("/responder/pool offers an explicit refresh instead of polling", async () => {
    // F3: a stale pool is the premise, not a defect.
    withProviders(await PoolPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("button", { name: /refresh/i })).toBeEnabled();
  });

  it("/responder/pool?report= opens that report beside the list", async () => {
    db.incident = sinkhole();

    withProviders(
      await PoolPage({ searchParams: Promise.resolve({ report: "inc-4501" }) }),
    );

    // NOW is 8m into the 4h promise, so 3h 52m of it is left. Spelled out
    // rather than matched loosely: the banner has an overdue phrasing too, and
    // a pattern that accepts either would call the wrong one a pass.
    expect(
      screen.getByText("Critical · 3h 52m of the 4h promise"),
    ).toBeInTheDocument();
    // The list survives selection — this is a two-pane, not a page swap.
    expect(screen.getByText("2 waiting in pool")).toBeInTheDocument();
  });

  // ADR 0001, decision 7: a Phone alert's tap lands here, and opening the
  // incident marks its pool-arrival Inbox entry read.
  it("/responder/pool?report= marks that incident's Inbox entry read", async () => {
    db.incident = sinkhole();

    withProviders(
      await PoolPage({ searchParams: Promise.resolve({ report: "inc-4501" }) }),
    );

    expect(markArrivalRead).toHaveBeenCalledWith("inc-4501");
  });

  it("/responder/pool marks nothing read while no report is open", async () => {
    withProviders(await PoolPage({ searchParams: Promise.resolve({}) }));

    expect(markArrivalRead).not.toHaveBeenCalled();
  });

  it("/responder/pool?report= ages the card and In pool from pooled_at, the header from submitted_at", async () => {
    // SCRUM-200: filed 8m ago, but staff only routed it 2m ago. The card and
    // the pane must agree on 2m; only the "Reported" header says 8m.
    const pooled = sinkhole({ pooled_at: "2026-08-12T00:06:00.000Z" });
    db.pool = [pooled];
    db.incident = pooled;

    withProviders(
      await PoolPage({ searchParams: Promise.resolve({ report: "inc-4501" }) }),
    );

    expect(screen.getByText("2m ago")).toBeInTheDocument();
    expect(screen.getByText("2m ago · unclaimed")).toBeInTheDocument();
    expect(
      screen.getByText(/Reported 8m ago\s*by Maria · routed by staff/),
    ).toBeInTheDocument();
  });

  it("/responder/pool?report= phrases a promise already missed as time past it", async () => {
    // The other branch of the banner, which the test above deliberately does
    // not take. Due 55m before NOW, armed 4h before that.
    db.incident = sinkhole({
      sla_armed_at: "2026-08-11T19:13:00.000Z",
      sla_due_at: "2026-08-11T23:13:00.000Z",
    });

    withProviders(
      await PoolPage({ searchParams: Promise.resolve({ report: "inc-4501" }) }),
    );

    expect(
      screen.getByText("Critical · 55m past the 4h promise"),
    ).toBeInTheDocument();
  });

  it("/responder/pool gates every Claim button while a ticket is held", async () => {
    db.held = sinkhole({ id: "inc-held", status: "in_progress" });

    withProviders(await PoolPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText("Finish your current ticket first — INC-2026-000076"),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", {
      name: "Finish your ticket first",
    })) {
      expect(button).toBeDisabled();
    }
  });

  it("/responder/pool?lost= names the winner straight from the URL", async () => {
    // The name comes from claim_incident, not from a lookup table — the app has
    // no lawful way to resolve a responder id to a name.
    withProviders(
      await PoolPage({
        searchParams: Promise.resolve({ lost: "Dev Responder One" }),
      }),
    );

    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Already claimed by Dev Responder One",
    );
  });

  it("/responder/pool?notice= explains a refused claim", async () => {
    withProviders(
      await PoolPage({ searchParams: Promise.resolve({ notice: "gone" }) }),
    );

    expect(
      screen.getByText("That report is no longer in the pool."),
    ).toBeInTheDocument();
  });

  it("/responder/my-ticket explains the one-claim rule when nothing is held", async () => {
    withProviders(await MyTicketPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("No active ticket")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the pool" })).toHaveAttribute(
      "href",
      "/responder/pool",
    );
  });

  it("/responder/my-ticket explains a force-release ON the empty state", async () => {
    // Decision E3, and the specific mistake it names: by the time the next tap
    // lands there is no ticket left to render the notice on, so the empty state
    // must carry it or the responder sees a blank screen mid-shift.
    withProviders(
      await MyTicketPage({
        searchParams: Promise.resolve({ notice: "force_released" }),
      }),
    );

    expect(screen.getByText("No active ticket")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A supervisor returned this ticket to the pool. It is back with your department.",
      ),
    ).toBeInTheDocument();
  });

  it("/responder/my-ticket?notice=blocked NAMES the ticket that refused the claim", async () => {
    // Issue #8 / #4 criterion 2. The reference comes from the held ROW the page
    // has already fetched, not from the URL -- a responder must be able to read
    // which ticket is in the way off the banner itself, and must not be able to
    // put a different reference there by editing the link.
    db.held = sinkhole({ status: "in_progress" });

    withProviders(
      await MyTicketPage({
        searchParams: Promise.resolve({ notice: "blocked" }),
      }),
    );

    expect(
      screen.getByText(
        "You are already holding INC-2026-000076. Finish or hand it back before claiming another.",
      ),
    ).toBeInTheDocument();
  });

  it("/responder/my-ticket?notice=blocked stays SILENT on the empty state", async () => {
    // Issue #9. The empty state still carries notices -- force_released above
    // depends on it -- but `blocked` with no held row is the one code whose
    // sentence the empty state's own words contradict, and a responder cannot
    // tell which of the two is lying. "No active ticket. You can hold one claim
    // at a time." already says everything `blocked` was there to say.
    db.held = null;

    withProviders(
      await MyTicketPage({
        searchParams: Promise.resolve({ notice: "blocked" }),
      }),
    );

    expect(screen.getByText("No active ticket")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/already holding/)).not.toBeInTheDocument();
  });

  it("/responder/my-ticket is a place work happens once a ticket is held", async () => {
    db.held = sinkhole({ status: "in_progress" });
    db.events = [anEvent({ event_type: "claimed", actor_name: "Juan" })];

    withProviders(await MyTicketPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Sinkhole")).toBeInTheDocument();
    expect(screen.getByText("Progress · tap as you go")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "En route" })).toBeEnabled();
    expect(
      screen.getByText("After photo · required to resolve"),
    ).toBeInTheDocument();
    expect(screen.getByText("Photo required")).toBeInTheDocument();
    expect(
      screen.getByText("Timeline · staff sees this live"),
    ).toBeInTheDocument();
    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolve · needs an after photo" }),
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: "Call Maria" })).toBeInTheDocument();
  });

  it("/responder/my-ticket?sheet=release warns that the clock keeps running", async () => {
    db.held = sinkhole({ status: "in_progress" });

    withProviders(
      await MyTicketPage({
        searchParams: Promise.resolve({ sheet: "release" }),
      }),
    );

    expect(screen.getByText("Release back to the pool")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "stays on the clock. The promise is to the citizen, not to you.",
    );
  });

  it("/responder/history keeps both stat tiles at an em dash on an empty account", async () => {
    // Story 53: a new account greeted by "0%" reads as a failing responder.
    withProviders(await HistoryPage());

    expect(screen.getByText("SLA met this month")).toBeInTheDocument();
    expect(screen.getByText("Reopened by citizen")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing finished yet")).toBeInTheDocument();
    // Both tiles say WHY they are blank, so a reader is not left to guess that
    // an em dash means zero.
    expect(
      screen.getByLabelText("SLA met this month: not yet measured"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Reopened by citizen: not yet measured"),
    ).toBeInTheDocument();
  });

  it("/responder/pool?resolved= gives the reporter's window from config", async () => {
    // SCRUM-191: the dialog said 3 days, which is confirmation_window_days.
    // An unconfirmed resolve closes after auto_close_day. 10 is not l09's
    // default, so this cannot pass on the fallback.
    db.config = { max_photos_per_cycle: 3, auto_close_day: 10 };
    db.history = [aHistoryRow({ id: "h1" })];

    withProviders(
      await PoolPage({ searchParams: Promise.resolve({ resolved: "1" }) }),
    );

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "The reporter has been notified and has 10 days to confirm before it closes on its own.",
    );
  });

  it("/responder/history measures a resolved ticket finished inside the month", async () => {
    // The control for this file's two em-dash assertions on these tiles.
    // `historyStats` only counts rows resolved since the first of the current
    // month, so a fixture that has aged out of that window reads "—" for a
    // reason those assertions do not claim to be testing. This proves NOW sits
    // inside the fixture's month: the same builder, resolved, IS measured.
    db.history = [aHistoryRow({ id: "h1" })];

    withProviders(await HistoryPage());

    // Resolved 2h into a 4h promise — inside it, so the rate is 100%.
    expect(
      screen.getByLabelText("SLA met this month: 100%"),
    ).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("/responder/history lists a RELEASED ticket, not only resolved ones", async () => {
    // Story 48: the work done on a ticket is not erased by handing it back.
    db.history = [
      aHistoryRow({
        id: "h1",
        reference_number: "INC-2026-000090",
        type_label: "Uncollected garbage",
        my_last_outcome: "released",
        resolved_at: null,
      }),
    ];

    withProviders(await HistoryPage());

    expect(screen.getByText("INC-2026-000090")).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.queryByText("Nothing finished yet")).not.toBeInTheDocument();
    // A release is not measured against the promise, so the rate stays
    // unmeasured — and the test above proves this row would have been measured
    // had it been resolved, so the em dash is the outcome talking and not the
    // calendar.
    expect(
      screen.getByLabelText("SLA met this month: not yet measured"),
    ).toBeInTheDocument();
    // The other tile is measured, and says 0 rather than "—": one release is a
    // real count of zero reopens, not an absence of data.
    expect(screen.getByLabelText("Reopened by citizen: 0")).toBeInTheDocument();
  });

  it("/responder/notifications renders as a page, not a sheet", async () => {
    withProviders(await NotificationsPage());

    expect(
      screen.getByRole("heading", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("/responder/notifications no longer promises a push the app cannot send", async () => {
    // ISO-9: a phone alert is opt-in per device (ADR 0001). The old copy said
    // "and as a push on your phone while you're on duty".
    withProviders(await NotificationsPage());

    expect(
      screen.getByText("New verified reports in your department land here."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/push/i)).not.toBeInTheDocument();
  });

  it("/responder/notifications lists the inbox once there is something in it", async () => {
    db.notifications = [
      aNotification({ id: "n1", title: "New report in the Engineering pool" }),
    ];

    withProviders(await NotificationsPage());

    expect(
      screen.getByText("New report in the Engineering pool"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /mark as read/i }),
    ).toBeInTheDocument();
  });

  it("/responder/profile renders the signed-in responder with an initials avatar", () => {
    withProviders(<ProfilePage />);

    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText(/Employee ID LGU-2026-0501/)).toBeInTheDocument();
    // Citizens never see the full legal name (account spec Q6).
    expect(screen.getByText(/Juan from Engineering/)).toBeInTheDocument();
  });

  it("/responder/profile says on duty is a headcount, and that the Inbox is the only channel where alerts cannot be offered", async () => {
    // ISO-9: "You'll get a push" promised a channel nothing sends. Where this
    // deployment cannot sign a phone up (no VAPID key; jsdom is that case) the
    // profile says the Inbox is the only channel, and never says "push". The
    // other states are PhoneAlertsSetting's (phone-alerts.test.tsx).
    withProviders(<ProfilePage />);

    expect(
      screen.getByText("Your department counts you in this shift."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Phone alerts are coming. Until then, new pool work shows only in your Inbox, so open the app to check.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/push/i)).not.toBeInTheDocument();
  });

  it("/responder/profile off duty keeps the pool open and says nothing is muted", () => {
    withProviders(<ProfilePage />, { ...PROFILE_ROW, on_duty: false });

    expect(
      screen.getByText(
        "Your department doesn't count you in this shift. The pool stays browsable and claimable.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/push|muted/i)).not.toBeInTheDocument();
  });

  it("/responder/profile no longer offers to reset a prototype that does not exist", () => {
    withProviders(<ProfilePage />);

    expect(screen.queryByText("Prototype")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset the prototype" }),
    ).not.toBeInTheDocument();
  });
});
