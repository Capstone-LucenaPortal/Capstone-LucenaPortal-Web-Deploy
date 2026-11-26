import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { BarangayFilter } from "@/portals/responder/features/incidents/components/barangay-filter";

const counts = [
  { name: "Cotta", count: 2 },
  { name: "Ibabang Iyam", count: 3 },
];

describe("BarangayFilter", () => {
  it("is disabled when the pool is empty and nothing is chosen", () => {
    render(<BarangayFilter counts={[]} total={0} selected={null} report={null} />);

    expect(screen.getByRole("button", { name: "Barangay" })).toBeDisabled();
  });

  it("stays enabled on an empty pool while a barangay is chosen, so there is a way back", () => {
    render(<BarangayFilter counts={[]} total={0} selected="Cotta" report={null} />);

    const button = screen.getByRole("button", { name: "Brgy. Cotta" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("reads Barangay, unpressed, while nothing is chosen", () => {
    render(<BarangayFilter counts={counts} total={5} selected={null} report={null} />);

    const button = screen.getByRole("button", { name: "Barangay" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("opens a sheet listing all barangays first, then each with its count", () => {
    render(
      <BarangayFilter counts={counts} total={5} selected="Cotta" report="inc-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Brgy. Cotta" }));

    const sheet = screen.getByRole("dialog", { name: "Filter by barangay" });
    const rows = within(sheet).getAllByRole("link");
    expect(rows.map((r) => r.textContent)).toEqual([
      "All barangays5",
      "Brgy. Cotta2",
      "Brgy. Ibabang Iyam3",
    ]);
    // Choosing a barangay does not close the report open beside the list.
    expect(rows.map((r) => r.getAttribute("href"))).toEqual([
      "/responder/pool?report=inc-1",
      "/responder/pool?report=inc-1&brgy=Cotta",
      "/responder/pool?report=inc-1&brgy=Ibabang+Iyam",
    ]);
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[0]).not.toHaveAttribute("aria-current");
  });

  it("closes the sheet once a barangay is picked", () => {
    render(<BarangayFilter counts={counts} total={5} selected={null} report={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Barangay" }));
    fireEvent.click(screen.getByRole("link", { name: /Ibabang Iyam/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
