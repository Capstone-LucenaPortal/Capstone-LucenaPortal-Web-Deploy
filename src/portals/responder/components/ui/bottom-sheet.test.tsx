import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";

/** A page with the sheet's opener on it and something behind the sheet. */
function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Sign out
      </button>
      <a href="/responder/pool">Pool</a>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Sign out?">
        <button type="button" onClick={() => setOpen(false)}>
          Stay signed in
        </button>
        <button type="button">Confirm</button>
      </BottomSheet>
    </>
  );
}

async function openSheet() {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  return user;
}

// SCRUM-223: a keyboard user opening a sheet lands in it, cannot tab out of
// it into the dimmed page, and is handed back to the opener when it closes.
describe("BottomSheet keyboard focus", () => {
  it("moves focus to the first control on open", async () => {
    await openSheet();

    expect(screen.getByRole("button", { name: "Stay signed in" })).toHaveFocus();
  });

  it("closes on Escape and hands focus back to the opener", async () => {
    const user = await openSheet();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside the sheet", async () => {
    const user = await openSheet();

    // The backdrop stays reachable: it is the only close control the photo
    // sheet has besides Escape.
    await user.tab();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Stay signed in" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });

  it("hides the page behind from assistive tech until it closes", async () => {
    const user = await openSheet();
    const behind = screen.getByRole("link", { name: "Pool" });

    expect(behind.closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("dialog").closest("[inert]")).toBeNull();

    await user.keyboard("{Escape}");

    expect(behind.closest("[inert]")).toBeNull();
  });

  it("hands focus back when closed from inside", async () => {
    const user = await openSheet();

    await user.click(screen.getByRole("button", { name: "Stay signed in" }));

    expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
  });
});
