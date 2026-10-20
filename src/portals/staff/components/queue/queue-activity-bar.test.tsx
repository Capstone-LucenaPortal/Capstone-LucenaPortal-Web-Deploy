import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueueActivityBar } from "./queue-activity-bar";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

/**
 * The poll the bar is given. A plain stub, not a spy on any module: the bar
 * takes its count action as a prop precisely so it belongs to no feature, and a
 * test that reached for one module's action would quietly re-attach it to that
 * module. Every queue's action has this shape — null on a failed read.
 *
 * Counts are returned one per call and the last one repeats forever, so a test
 * that only cares about the steady state passes a single value.
 */
function stubAction(...counts: (number | null)[]) {
  const remaining = [...counts];
  return vi.fn(async () => remaining.length > 1 ? remaining.shift()! : remaining[0]);
}

/** Advance past one 30s poll tick and let its promise settle. */
async function tick(times = 1) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("QueueActivityBar", () => {
  it("shows no badge when nothing has arrived", async () => {
    render(<QueueActivityBar count={6} countAction={stubAction(6)} noun="new" />);
    await tick();

    expect(screen.queryByText(/\bnew\b/)).not.toBeInTheDocument();
  });

  it("keeps the refresh button visible even with no arrivals", async () => {
    render(<QueueActivityBar count={6} countAction={stubAction(6)} noun="new" />);
    await tick();

    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });

  it("announces arrivals once the poll outruns the baseline", async () => {
    render(<QueueActivityBar count={6} countAction={stubAction(8)} noun="new" />);
    expect(screen.queryByText("2 new")).not.toBeInTheDocument();

    await tick();

    expect(screen.getByText("2 new")).toBeInTheDocument();
  });

  it("announces them in the caller's noun, not a wording of its own", async () => {
    render(
      <QueueActivityBar count={6} countAction={stubAction(8)} noun="more waiting" />,
    );
    await tick();

    expect(screen.getByText("2 more waiting")).toBeInTheDocument();
  });

  it("does not poll while the tab is hidden", async () => {
    const countAction = stubAction(9);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);

    render(<QueueActivityBar count={6} countAction={countAction} noun="new" />);
    await tick(3);

    expect(countAction).not.toHaveBeenCalled();
    expect(screen.queryByText(/\bnew\b/)).not.toBeInTheDocument();
  });

  it("clamps rather than showing a negative when colleagues clear the queue", async () => {
    render(<QueueActivityBar count={6} countAction={stubAction(2)} noun="new" />);
    await tick();

    expect(screen.queryByText(/\bnew\b/)).not.toBeInTheDocument();
  });

  it("keeps the last known badge when a poll fails, instead of clearing it", async () => {
    const countAction = stubAction(8, null);

    render(<QueueActivityBar count={6} countAction={countAction} noun="new" />);
    await tick();
    expect(screen.getByText("2 new")).toBeInTheDocument();

    await tick();

    expect(countAction).toHaveBeenCalledTimes(2);
    expect(screen.getByText("2 new")).toBeInTheDocument();
  });

  it("refreshes the route rather than reloading, preserving tab and search", async () => {
    render(<QueueActivityBar count={6} countAction={stubAction(6)} noun="new" />);
    await act(async () => {
      screen.getByRole("button", { name: /refresh/i }).click();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("clears the badge when the server sends a fresh count after a refresh", async () => {
    const countAction = stubAction(8);

    const { rerender } = render(
      <QueueActivityBar count={6} countAction={countAction} noun="new" />,
    );
    await tick();
    expect(screen.getByText("2 new")).toBeInTheDocument();

    // router.refresh() re-runs the server components, which send the new count
    // down as a prop. The baseline re-syncs and the badge goes quiet.
    await act(async () => {
      rerender(<QueueActivityBar count={8} countAction={countAction} noun="new" />);
    });

    expect(screen.queryByText(/\bnew\b/)).not.toBeInTheDocument();
  });

  it("keeps polling when the caller passes a fresh action on every render", async () => {
    const countAction = stubAction(8);
    const freshEachRender = () => (
      <QueueActivityBar count={6} countAction={() => countAction()} noun="new" />
    );

    const { rerender } = render(freshEachRender());

    // Re-renders arriving faster than the poll interval. A timer that depended
    // on the action's identity would be torn down and rebuilt on each one, so
    // thirty seconds would never elapse and the poll would never fire.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });
      await act(async () => {
        rerender(freshEachRender());
      });
    }

    expect(screen.getByText("2 new")).toBeInTheDocument();
  });

  it("exposes the badge to assistive tech as a polite live region", async () => {
    render(<QueueActivityBar count={6} countAction={stubAction(7)} noun="new" />);
    await tick();

    expect(screen.getByText("1 new").closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
