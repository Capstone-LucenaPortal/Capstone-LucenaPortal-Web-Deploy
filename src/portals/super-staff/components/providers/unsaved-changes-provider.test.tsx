import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  UnsavedChangesProvider,
  useReportUnsavedChanges,
  useUnsavedChanges,
} from "./unsaved-changes-provider";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-staff/configuration/incidents",
  useRouter: () => ({ push }),
}));

// Stands in for a nav link (asks to leave, and navigates itself only when the
// guard lets it through) on a Configuration tab that reports its dirty flag.
function Harness({ dirty, href = "/super-staff/accounts" }: { dirty?: boolean; href?: string }) {
  return dirty === undefined ? <LeaveLink href={href} /> : <DirtyTab dirty={dirty} href={href} />;
}

function DirtyTab({ dirty, href }: { dirty: boolean; href: string }) {
  useReportUnsavedChanges(dirty);
  return <LeaveLink href={href} />;
}

function LeaveLink({ href }: { href: string }) {
  const { requestLeave } = useUnsavedChanges();
  return (
    <button type="button" onClick={() => requestLeave(href) && push(href)}>
      Leave
    </button>
  );
}

function renderGuard(dirty: boolean, href?: string) {
  return render(
    <UnsavedChangesProvider>
      <Harness dirty={dirty} href={href} />
    </UnsavedChangesProvider>,
  );
}

beforeEach(() => push.mockReset());

describe("UnsavedChangesProvider", () => {
  it("lets a clean page leave at once, with no modal", async () => {
    renderGuard(false);

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(push).toHaveBeenCalledWith("/super-staff/accounts");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks a dirty page and asks to discard", async () => {
    renderGuard(true);

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Discard unsaved changes?");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "You have edits on this tab that haven’t been saved. Leaving will discard them.",
    );
  });

  it("Keep editing closes the modal and stays put", async () => {
    renderGuard(true);

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("Discard changes goes to the link that was clicked", async () => {
    renderGuard(true);

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledExactlyOnceWith("/super-staff/accounts");
  });

  it("does not ask for a link to the page already open", async () => {
    renderGuard(true, "/super-staff/configuration/incidents");

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warns on reload or close only while dirty", () => {
    const { rerender } = renderGuard(true);
    const dirtyUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyUnload);
    expect(dirtyUnload.defaultPrevented).toBe(true);

    rerender(
      <UnsavedChangesProvider>
        <Harness dirty={false} />
      </UnsavedChangesProvider>,
    );
    const cleanUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });

  it("stops guarding once the dirty tab unmounts", async () => {
    const { rerender } = renderGuard(true);
    rerender(
      <UnsavedChangesProvider>
        <Harness />
      </UnsavedChangesProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(push).toHaveBeenCalledWith("/super-staff/accounts");
  });
});

