import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LostRaceDialog } from "@/portals/responder/features/incidents/components/lost-race-dialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => push.mockClear());

describe("LostRaceDialog", () => {
  // SCRUM-223. Server-rendered from the URL, so nothing opened it from this
  // page; focus has to be put there.
  it("is modal and takes focus itself when it appears", () => {
    render(<LostRaceDialog rivalName="Ramon Cruz" />);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("hides the pool behind it", () => {
    render(
      <div>
        <a href="/responder/pool?report=1">A report</a>
        <LostRaceDialog rivalName="Ramon Cruz" />
      </div>,
    );

    expect(screen.getByRole("link", { name: "A report" })).toHaveAttribute("inert");
  });

  it("closes on Escape by following its dismiss link", async () => {
    const user = userEvent.setup();
    render(<LostRaceDialog rivalName="Ramon Cruz" />);

    await user.keyboard("{Escape}");

    expect(push).toHaveBeenCalledWith("/responder/pool");
  });

  it("keeps Tab between the backdrop and its button", async () => {
    const user = userEvent.setup();
    render(<LostRaceDialog rivalName="Ramon Cruz" />);

    await user.tab();
    expect(screen.getByRole("link", { name: "Back to pool" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Dismiss" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Back to pool" })).toHaveFocus();
  });

  it("names the rival and explains that first claim wins", () => {
    render(<LostRaceDialog rivalName="Ramon Cruz" />);

    const dialog = screen.getByRole("alertdialog");

    expect(dialog).toHaveAccessibleName("Already claimed by Ramon Cruz");
    expect(
      screen.getByText(
        "Ramon Cruz tapped Claim a second before you. First claim wins — the ticket has left your pool.",
      ),
    ).toBeInTheDocument();
  });

  it("dismisses by link, from the button and from the backdrop", () => {
    render(<LostRaceDialog rivalName="Ramon Cruz" />);

    expect(
      screen.getByRole("link", { name: "Back to pool" }),
    ).toHaveAttribute("href", "/responder/pool");
    expect(screen.getByRole("link", { name: "Dismiss" })).toHaveAttribute(
      "href",
      "/responder/pool",
    );
  });
});
