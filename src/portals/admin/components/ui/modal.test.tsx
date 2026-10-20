// src/portals/admin/components/ui/modal.test.tsx
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/portals/admin/components/ui/modal";
import { vi } from "vitest";

// Harness that mirrors real usage: a trigger button opens the modal, and
// closing it (via onClose) flips isOpen back to false. Needed for the
// focus-return-to-trigger assertions, which require a real "something had
// focus before the modal opened" starting point.
function TriggerAndModal({
  children,
  footer,
}: {
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Open modal</button>
      <Modal title="Test Modal" isOpen={isOpen} onClose={() => setIsOpen(false)} footer={footer}>
        {children ?? <p>content</p>}
      </Modal>
    </div>
  );
}

afterEach(() => {
  // Guard against a test leaving the real document body locked if an
  // assertion throws mid-test.
  document.body.style.overflow = "";
});

describe("Modal", () => {
  it("renders nothing when isOpen is false", () => {
    render(
      <Modal title="Test" isOpen={false} onClose={() => {}}>
        <p>content</p>
      </Modal>
    );
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders the title and children when isOpen is true", () => {
    render(
      <Modal title="Application Review" isOpen onClose={() => {}}>
        <p>content</p>
      </Modal>
    );
    expect(screen.getByText("Application Review")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Test" isOpen onClose={onClose}>
        <p>content</p>
      </Modal>
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders footer content when provided", () => {
    render(
      <Modal title="Test" isOpen onClose={() => {}} footer={<button>Approve</button>}>
        <p>content</p>
      </Modal>
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("labels the dialog via aria-labelledby pointing at the heading", () => {
    render(
      <Modal title="Test Modal" isOpen onClose={() => {}}>
        <p>content</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { name: "Test Modal" });
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    expect(heading.id).toBeTruthy();
  });

  it("locks body scroll while open and restores it on close", async () => {
    const user = userEvent.setup();
    render(<TriggerAndModal />);
    expect(document.body.style.overflow).toBe("");

    await user.click(screen.getByRole("button", { name: "Open modal" }));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });

  it("resets body scroll lock when the modal unmounts without onClose firing", () => {
    const { unmount } = render(
      <Modal title="Test" isOpen onClose={() => {}}>
        <p>content</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("gives the initial-focus heading a visible focus indicator instead of a bare outline removal", () => {
    render(
      <Modal title="Test" isOpen onClose={() => {}}>
        <p>content</p>
      </Modal>
    );
    const heading = screen.getByRole("heading", { name: "Test" });
    // Regression guard: `outline-none` alone (with nothing compensating for
    // it) silently strips the browser's default focus ring from the one
    // element that receives focus on every modal open. Assert a visible
    // focus-ring utility is present alongside it. Uses the project-wide
    // `focus-visible:` convention (Task 3.3).
    expect(heading.className).toMatch(/\bfocus-visible:ring-2\b/);
    expect(heading.className).toMatch(/\bfocus-visible:ring-blue-900\b/);
  });

  it("moves focus into the dialog heading when opened", async () => {
    const user = userEvent.setup();
    render(<TriggerAndModal />);
    await user.click(screen.getByRole("button", { name: "Open modal" }));

    const heading = screen.getByRole("heading", { name: "Test Modal" });
    expect(document.activeElement).toBe(heading);
  });

  it("returns focus to the trigger element when closed via Escape", async () => {
    const user = userEvent.setup();
    render(<TriggerAndModal />);

    const trigger = screen.getByRole("button", { name: "Open modal" });
    await user.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Test Modal" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test" isOpen onClose={onClose}>
        <p>content</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps focus from the last focusable element back to the first on Tab", () => {
    render(
      <Modal title="Test" isOpen onClose={() => {}} footer={<button>Save</button>}>
        <button>Action</button>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    const saveButton = screen.getByRole("button", { name: "Save" });

    saveButton.focus();
    expect(document.activeElement).toBe(saveButton);

    fireEvent.keyDown(saveButton, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  it("wraps focus from the first focusable element back to the last on Shift+Tab", () => {
    render(
      <Modal title="Test" isOpen onClose={() => {}} footer={<button>Save</button>}>
        <button>Action</button>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    const saveButton = screen.getByRole("button", { name: "Save" });

    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(saveButton);
  });

  it("does not throw and keeps focus on the close button when only it is focusable", () => {
    render(
      <Modal title="Test" isOpen onClose={() => {}}>
        <p>no focusable content here</p>
      </Modal>
    );
    const closeButton = screen.getByRole("button", { name: "Close" });
    closeButton.focus();

    fireEvent.keyDown(closeButton, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeButton);
  });
});
