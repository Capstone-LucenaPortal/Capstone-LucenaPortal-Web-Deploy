import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PasswordSheet } from "@/portals/responder/features/auth/components/password-sheet";

function open(onSubmit = vi.fn().mockResolvedValue(null)) {
  render(<PasswordSheet open onClose={vi.fn()} onSubmit={onSubmit} />);
  return {
    onSubmit,
    current: screen.getByLabelText("Current password"),
    next: screen.getByLabelText("New password"),
    confirm: screen.getByLabelText("Confirm new password"),
    update: screen.getByRole("button", { name: "Update" }),
  };
}

const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });

function fillValid(f: ReturnType<typeof open>) {
  type(f.current, "oldpassword");
  type(f.next, "longenough1");
  type(f.confirm, "longenough1");
}

describe("password sheet", () => {
  it("blocks submit on an untouched form", () => {
    const { update } = open();

    expect(update).toBeDisabled();
  });

  it("flags a password under 8 characters", () => {
    const { next, update } = open();

    type(next, "short");

    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(next).toHaveAttribute("aria-invalid", "true");
    expect(update).toBeDisabled();
  });

  it("clears the length warning once long enough", () => {
    const { next } = open();

    type(next, "longenough1");

    expect(next).not.toHaveAttribute("aria-invalid");
  });

  it("blocks submit while the confirmation does not match", () => {
    const { current, next, confirm, update } = open();

    type(current, "oldpassword");
    type(next, "longenough1");
    type(confirm, "longenough2");

    expect(screen.getByText("Those two don't match yet.")).toBeInTheDocument();
    expect(update).toBeDisabled();
  });

  it("still blocks submit without the current password", () => {
    const { next, confirm, update } = open();

    type(next, "longenough1");
    type(confirm, "longenough1");

    expect(update).toBeDisabled();
  });

  it("hands both passwords to the caller once every rule passes", () => {
    const f = open();
    fillValid(f);

    expect(f.update).toBeEnabled();
    fireEvent.click(f.update);

    expect(f.onSubmit).toHaveBeenCalledWith("oldpassword", "longenough1");
  });

  it("shows the caller's error and keeps the sheet open", async () => {
    // The caller is what knows whether the current password was right --
    // Supabase's updateUser does not check it, so the sheet cannot.
    const f = open(
      vi.fn().mockResolvedValue("That current password isn't right."),
    );
    fillValid(f);
    fireEvent.click(f.update);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That current password isn't right.",
    );
  });

  it("disables the button while the change is in flight", async () => {
    let release: (v: string | null) => void = () => {};
    const pending = new Promise<string | null>((r) => (release = r));
    const f = open(vi.fn().mockReturnValue(pending));
    fillValid(f);
    fireEvent.click(f.update);

    // A second tap would send a second sign-in and a second updateUser.
    await waitFor(() => expect(f.update).toBeDisabled());
    release(null);
  });
});
