import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/portals/responder/components/ui/modal";

function Shell({ opener, modal }: { opener: boolean; modal: boolean }) {
  return (
    <main tabIndex={-1}>
      {opener && <button type="button">Release</button>}
      {modal && (
        <Modal onClose={vi.fn()}>
          <div role="dialog" aria-modal="true" aria-label="Release" tabIndex={-1}>
            <button type="button">Keep working</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

describe("Modal", () => {
  // Release redirects to the pool: the sheet and the button that opened it
  // leave together, and focus must not fall to <body>.
  it("hands focus to <main> when the opener is gone", () => {
    const { rerender } = render(<Shell opener modal={false} />);
    screen.getByRole("button", { name: "Release" }).focus();
    rerender(<Shell opener modal />);

    rerender(<Shell opener={false} modal={false} />);

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("focuses an alertdialog itself rather than its first control", () => {
    render(
      <Modal onClose={vi.fn()}>
        <div role="alertdialog" aria-modal="true" aria-label="Lost" tabIndex={-1}>
          <a href="/responder/pool">Back to pool</a>
        </div>
      </Modal>,
    );

    expect(screen.getByRole("alertdialog")).toHaveFocus();
  });

  it("lets only the topmost of two open modals answer Escape", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <Modal onClose={outer}>
          <div role="dialog" aria-modal="true" aria-label="Outer" />
        </Modal>
        <Modal onClose={inner}>
          <div role="dialog" aria-modal="true" aria-label="Inner" />
        </Modal>
      </>,
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  // Next's route announcer is a body-level live region whose role lives in
  // shadow DOM; inert would silence page-change announcements under a modal.
  it("leaves Next's route announcer alone", () => {
    const announcer = document.createElement("next-route-announcer");
    document.body.append(announcer);
    render(
      <Modal onClose={vi.fn()}>
        <div role="dialog" aria-modal="true" aria-label="Release" tabIndex={-1} />
      </Modal>,
    );

    expect(announcer).not.toHaveAttribute("inert");
    announcer.remove();
  });

  // The photo sheet offline: every control in the panel is disabled, so
  // focus sits on the panel, and Tab must not walk off it.
  it("keeps Tab inside when focus is on the panel itself", async () => {
    const user = userEvent.setup();
    render(
      <Modal onClose={vi.fn()}>
        <button type="button" aria-label="Close" />
        <div role="dialog" aria-modal="true" aria-label="Photo" tabIndex={-1}>
          <button type="button" disabled>
            Take photo
          </button>
        </div>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveFocus();

    await user.tab();

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});
