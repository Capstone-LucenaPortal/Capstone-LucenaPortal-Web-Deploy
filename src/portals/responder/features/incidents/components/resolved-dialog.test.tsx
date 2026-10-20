import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResolvedDialog } from "@/portals/responder/features/incidents/components/resolved-dialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => push.mockClear());

describe("ResolvedDialog", () => {
  // SCRUM-223. Arrives by redirect from /my-ticket, so nothing on this page
  // opened it; focus has to be put there.
  it("takes focus itself when it appears", () => {
    render(<ResolvedDialog marginMs={0} confirmDays={7} />);

    expect(screen.getByRole("alertdialog")).toHaveFocus();
  });

  it("closes on Escape by following its dismiss link", async () => {
    const user = userEvent.setup();
    render(<ResolvedDialog marginMs={0} confirmDays={7} />);

    await user.keyboard("{Escape}");

    expect(push).toHaveBeenCalledWith("/responder/pool");
  });

  it("keeps Tab between the backdrop and its button", async () => {
    const user = userEvent.setup();
    render(<ResolvedDialog marginMs={0} confirmDays={7} />);

    await user.tab();
    expect(screen.getByRole("link", { name: "Back to the pool" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Back to the pool" })).toHaveFocus();
  });

  it("counts the time saved and explains the citizen's window", () => {
    render(
      <ResolvedDialog marginMs={(2 * 60 + 14) * 60_000} confirmDays={7} />,
    );

    expect(
      screen.getByText("Resolved with 2h 14m to spare"),
    ).toBeInTheDocument();
    // The window is incident_config.auto_close_day (SCRUM-191), not the 3-day
    // confirmation_window_days, which expires reports nobody verified.
    // "Notified" is true since l78 (SCRUM-180): resolve_incident writes the
    // citizen a resolution_submitted notice quoting the same auto_close_day.
    expect(
      screen.getByText(
        "The reporter has been notified and has 7 days to confirm before it closes on its own. If they reject it, the ticket returns to the pool with the SLA re-armed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the pool" }),
    ).toHaveAttribute("href", "/responder/pool");
  });

  it("does not hide a late resolve", () => {
    render(<ResolvedDialog marginMs={-40 * 60_000} confirmDays={7} />);

    expect(screen.getByText("Resolved 40m over")).toBeInTheDocument();
  });

  it("says plainly when there was never a clock", () => {
    render(<ResolvedDialog marginMs={null} confirmDays={7} />);

    expect(
      screen.getByText("Resolved — no SLA was running"),
    ).toBeInTheDocument();
  });

  it("is announced as a dialog", () => {
    render(<ResolvedDialog marginMs={0} confirmDays={7} />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
