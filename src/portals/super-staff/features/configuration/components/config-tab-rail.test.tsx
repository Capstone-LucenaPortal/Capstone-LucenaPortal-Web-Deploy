import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnsavedChangesProvider } from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import { ConfigTabRail } from "./config-tab-rail";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-staff/configuration/incidents",
  useRouter: () => ({ push }),
}));

function renderRail(dirty: boolean) {
  render(
    <UnsavedChangesProvider>
      <ConfigTabRail dirty={dirty} />
    </UnsavedChangesProvider>,
  );
}

beforeEach(() => push.mockReset());

describe("ConfigTabRail", () => {
  it("switches tabs at once when nothing is unsaved", async () => {
    renderRail(false);

    await userEvent.click(screen.getByRole("button", { name: "Booking" }));

    expect(push).toHaveBeenCalledWith("/super-staff/configuration/booking");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks once before switching away from unsaved edits, then switches on discard", async () => {
    renderRail(true);

    await userEvent.click(screen.getByRole("button", { name: "Booking" }));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(push).toHaveBeenCalledExactlyOnceWith("/super-staff/configuration/booking");
  });

  it("ignores a click on the tab already open", async () => {
    renderRail(true);

    await userEvent.click(screen.getByRole("button", { name: "Incidents" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
