import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  rejectTicket,
  releaseTicket,
} from "@/portals/responder/features/incidents/actions";
import { ReleaseSheet } from "@/portals/responder/features/incidents/components/release-sheet";
import { RejectSheet } from "@/portals/responder/features/incidents/components/reject-sheet";

vi.mock("@/portals/responder/features/incidents/actions", () => ({
  releaseTicket: vi.fn(),
  rejectTicket: vi.fn(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

let answer: (() => void) | undefined;

afterEach(async () => {
  // A transition left in flight leaks into the next test's form status.
  await act(async () => answer?.());
  answer = undefined;
  vi.restoreAllMocks();
  push.mockClear();
  vi.mocked(releaseTicket).mockReset();
  vi.mocked(rejectTicket).mockReset();
});

/** A server action that has not answered yet — a slow field connection. */
function slowAnswer() {
  return new Promise<void>((resolve) => {
    answer = resolve;
  });
}

// Both sheets close by navigating to closeHref. Offline that navigation would
// fall back to a full page load and the browser's error page (issue #7).
describe("closing an exit sheet", () => {
  it("navigates to closeHref while connected", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<RejectSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(push).toHaveBeenCalledWith("/responder/my-ticket");
  });

  it("stays open while offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(
      <ReleaseSheet closeHref="/responder/my-ticket" remaining={null} incidentId="inc-1" />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(push).not.toHaveBeenCalled();
  });
});

// SCRUM-223. Both forms open on a hidden incidentId input, which cannot take
// focus; focus has to land on the first thing the responder can use.
describe("opening an exit sheet", () => {
  it("puts focus on the first release reason", () => {
    render(
      <ReleaseSheet closeHref="/responder/my-ticket" remaining={null} incidentId="inc-1" />,
    );

    expect(screen.getByRole("radio", { name: "Shift ending" })).toHaveFocus();
  });

  it("puts focus on the misroute reason", () => {
    render(<RejectSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

    expect(screen.getByLabelText("Why is this a misroute?")).toHaveFocus();
  });
});

describe("ReleaseSheet", () => {
  it("warns that the clock does not stop, and says how much is left", () => {
    render(
      <ReleaseSheet
        closeHref="/responder/my-ticket"
        remaining="3h 52m"
        incidentId="inc-1"
      />,
    );

    expect(screen.getByText("Release back to the pool")).toBeInTheDocument();
    expect(screen.getByText("3h 52m")).toBeInTheDocument();
    // The sentence is split around a <b>, so it is asserted on the dialog
    // rather than on any one element.
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "The SLA keeps running — 3h 52m stays on the clock. The promise is to the citizen, not to you.",
    );
  });

  it("says the honest thing when no clock was running", () => {
    render(
      <ReleaseSheet closeHref="/responder/my-ticket" remaining={null} incidentId="inc-1" />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "No clock is running on this one. It goes back to the pool exactly as it came.",
    );
    expect(screen.getByRole("dialog")).not.toHaveTextContent(
      "The SLA keeps running",
    );
  });

  it("offers the four reasons and REQUIRES one", () => {
    render(
      <ReleaseSheet
        closeHref="/responder/my-ticket"
        remaining="3h 52m"
        incidentId="inc-1"
      />,
    );

    for (const reason of [
      "Shift ending",
      "Site blocked",
      "Need equipment",
      "Need more people",
    ]) {
      expect(screen.getByRole("radio", { name: reason })).toBeInTheDocument();
    }

    // Ruled 2026-08-12: the reason is mandatory on release as well as reject.
    // release_incident writes an event row, and that row is the ONLY record
    // that reaches the next responder — a hand-back with no reason tells them
    // nothing. The design styled Release unconditionally; that is overridden.
    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled();
  });

  it("enables Release once a reason is picked", () => {
    render(
      <ReleaseSheet
        closeHref="/responder/my-ticket"
        remaining="3h 52m"
        incidentId="inc-1"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Shift ending" }));

    expect(screen.getByRole("button", { name: "Release" })).toBeEnabled();
  });

  it("selects a reason when one is picked", () => {
    render(
      <ReleaseSheet
        closeHref="/responder/my-ticket"
        remaining="3h 52m"
        incidentId="inc-1"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Site blocked" }));

    expect(screen.getByRole("radio", { name: "Site blocked" })).toBeChecked();
  });

  it("offers a way to stay", () => {
    render(
      <ReleaseSheet
        closeHref="/responder/my-ticket"
        remaining="3h 52m"
        incidentId="inc-1"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Keep working" }),
    ).toHaveAttribute("href", "/responder/my-ticket");
  });
});

describe("RejectSheet", () => {
  it("explains that staff re-route, not you", () => {
    render(<RejectSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

    expect(screen.getByText("Send back to staff")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use this only when the job isn't ours. Staff re-route it — you don't pick the department.",
      ),
    ).toBeInTheDocument();
  });

  it("will not send an unexplained misroute", () => {
    render(<RejectSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

    expect(screen.getByRole("button", { name: "Send back" })).toBeDisabled();
  });

  it("still will not send on whitespace alone", () => {
    render(<RejectSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

    fireEvent.change(screen.getByLabelText("Why is this a misroute?"), {
      target: { value: "   " },
    });

    expect(screen.getByRole("button", { name: "Send back" })).toBeDisabled();
  });

  it("sends once there is a reason", () => {
    render(<RejectSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

    fireEvent.change(screen.getByLabelText("Why is this a misroute?"), {
      target: { value: "Streetlight pole — belongs to Electrical" },
    });

    expect(screen.getByRole("button", { name: "Send back" })).toBeEnabled();
  });
});

// ISO-9: on a slow connection a second tap must not double-act on an incident.
describe("double submission", () => {
  function pickReason() {
    fireEvent.click(screen.getByRole("radio", { name: "Shift ending" }));
  }

  function typeReason() {
    fireEvent.change(screen.getByLabelText("Why is this a misroute?"), {
      target: { value: "Streetlight pole — belongs to Electrical" },
    });
  }

  it("sends one release however often Release is tapped", async () => {
    vi.mocked(releaseTicket).mockImplementation(slowAnswer);
    render(
      <ReleaseSheet closeHref="/responder/my-ticket" remaining={null} incidentId="inc-1" />,
    );
    pickReason();
    const release = screen.getByRole("button", { name: "Release" });

    // Both taps land before React re-renders — the case a disabled button
    // cannot catch, so the second must be dropped at the action.
    await act(async () => {
      fireEvent.click(release);
      fireEvent.click(release);
    });

    expect(releaseTicket).toHaveBeenCalledTimes(1);
  });

  it("sends one send-back however often Send back is tapped", async () => {
    vi.mocked(rejectTicket).mockImplementation(slowAnswer);
    render(<RejectSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);
    typeReason();
    const sendBack = screen.getByRole("button", { name: "Send back" });

    // Both taps land before React re-renders — the case a disabled button
    // cannot catch, so the second must be dropped at the action.
    await act(async () => {
      fireEvent.click(sendBack);
      fireEvent.click(sendBack);
    });

    expect(rejectTicket).toHaveBeenCalledTimes(1);
  });
});
