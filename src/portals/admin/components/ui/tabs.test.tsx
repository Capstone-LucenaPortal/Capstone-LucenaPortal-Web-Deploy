import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "@/portals/admin/components/ui/tabs";
import { vi } from "vitest";

describe("Tabs", () => {
  it("renders a tablist and marks the active tab selected", () => {
    render(<Tabs tabs={["All", "Approved", "Pending"]} active="All" onChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    const allTab = screen.getByRole("tab", { name: "All" });
    const pendingTab = screen.getByRole("tab", { name: "Pending" });
    expect(allTab).toHaveAttribute("aria-selected", "true");
    expect(pendingTab).toHaveAttribute("aria-selected", "false");
  });

  it("only the active tab sits in the natural tab order (roving tabindex)", () => {
    render(<Tabs tabs={["All", "Approved", "Pending"]} active="Approved" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Approved" })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("tabIndex", "-1");
    expect(screen.getByRole("tab", { name: "Pending" })).toHaveAttribute("tabIndex", "-1");
  });

  it("calls onChange with the clicked tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={["All", "Approved", "Pending"]} active="All" onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: "Pending" }));
    expect(onChange).toHaveBeenCalledWith("Pending");
  });

  it("ArrowRight/ArrowLeft move focus and activate the neighboring tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={["All", "Approved", "Pending"]} active="All" onChange={onChange} />);
    screen.getByRole("tab", { name: "All" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("Approved");

    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("All");
  });

  it("Home/End jump to the first/last tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={["All", "Approved", "Pending"]} active="Approved" onChange={onChange} />);
    screen.getByRole("tab", { name: "Approved" }).focus();

    await user.keyboard("{End}");
    expect(onChange).toHaveBeenCalledWith("Pending");

    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenCalledWith("All");
  });

  it("renders an optional per-tab count", () => {
    render(
      <Tabs
        tabs={[{ label: "All", count: 12 }, { label: "Approved", count: 3 }]}
        active="All"
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("tab", { name: "All (12)" })).toBeInTheDocument();
  });
});
