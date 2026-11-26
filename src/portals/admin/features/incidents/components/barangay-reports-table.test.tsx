// src/portals/admin/features/incidents/components/barangay-reports-table.test.tsx
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarangayReportsTable } from "@/portals/admin/features/incidents/components/barangay-reports-table";
import type { BarangayIssueRow } from "@/portals/admin/features/incidents/types";

const rows: BarangayIssueRow[] = [
  { barangay: "Barangay One", reports: 5, topCategory: "Infrastructure", topCategoryCount: 3 },
  { barangay: "Barangay Two", reports: 1, topCategory: "Sanitation", topCategoryCount: 1 },
];

const insight = { emphasis: "Barangay One", text: "has the most reports." };

// The header row's <th>s in document order: [0] Barangay (sortable),
// [1] Reports (sortable, colSpan 2), [2] Top Category (NOT sortable).
function getHeaders(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("thead th"));
}

describe("BarangayReportsTable aria-sort", () => {
  it("defaults to Reports sorted descending, Barangay unsorted", () => {
    const { container } = render(<BarangayReportsTable rows={rows} insight={insight} canExport />);
    const [barangayTh, reportsTh] = getHeaders(container);

    // Matches the component's initial state: useState<SortKey>("reports"),
    // useState<SortDir>("desc").
    expect(barangayTh).toHaveAttribute("aria-sort", "none");
    expect(reportsTh).toHaveAttribute("aria-sort", "descending");
  });

  it("the non-sortable Top Category header never gets an aria-sort attribute", () => {
    const { container } = render(<BarangayReportsTable rows={rows} insight={insight} canExport />);
    const [, , topCategoryTh] = getHeaders(container);

    // Per the brief's Step 2, aria-sort belongs only on sortable columns —
    // not "none" as a literal value, the attribute must be entirely absent.
    expect(topCategoryTh).not.toHaveAttribute("aria-sort");
  });

  it("clicking the inactive Barangay header sorts it ascending and resets Reports to none", async () => {
    const user = userEvent.setup();
    const { container } = render(<BarangayReportsTable rows={rows} insight={insight} canExport />);
    const [barangayTh, reportsTh] = getHeaders(container);

    await user.click(within(barangayTh).getByRole("button"));

    expect(barangayTh).toHaveAttribute("aria-sort", "ascending");
    expect(reportsTh).toHaveAttribute("aria-sort", "none");
  });

  it("clicking the already-active Barangay header toggles ascending then descending", async () => {
    const user = userEvent.setup();
    const { container } = render(<BarangayReportsTable rows={rows} insight={insight} canExport />);
    const [barangayTh] = getHeaders(container);
    const barangayButton = within(barangayTh).getByRole("button");

    await user.click(barangayButton); // inactive -> ascending
    expect(barangayTh).toHaveAttribute("aria-sort", "ascending");

    await user.click(barangayButton); // active -> toggles to descending
    expect(barangayTh).toHaveAttribute("aria-sort", "descending");

    await user.click(barangayButton); // active -> toggles back to ascending
    expect(barangayTh).toHaveAttribute("aria-sort", "ascending");
  });

  it("clicking the already-active Reports header toggles descending then ascending", async () => {
    const user = userEvent.setup();
    const { container } = render(<BarangayReportsTable rows={rows} insight={insight} canExport />);
    const [, reportsTh] = getHeaders(container);
    const reportsButton = within(reportsTh).getByRole("button");

    expect(reportsTh).toHaveAttribute("aria-sort", "descending");

    await user.click(reportsButton); // active -> toggles to ascending
    expect(reportsTh).toHaveAttribute("aria-sort", "ascending");

    await user.click(reportsButton); // active -> toggles back to descending
    expect(reportsTh).toHaveAttribute("aria-sort", "descending");
  });
});

// #39: the empty state is chosen by whether the range has any rows at all,
// not by what the category dropdown says.
describe("BarangayReportsTable empty states", () => {
  function getTableBody(container: HTMLElement) {
    return container.querySelector<HTMLElement>("tbody")!;
  }

  it("says the range has no reports when rows are empty and the filter is All categories", () => {
    const { container } = render(<BarangayReportsTable rows={[]} insight={insight} canExport={false} />);

    expect(getTableBody(container)).toHaveTextContent("No reports in this range.");
    expect(getTableBody(container)).not.toHaveTextContent("as its top category");
  });

  it("says the range has no reports when a real category is left selected and the range empties", async () => {
    const user = userEvent.setup();
    const { container, getByLabelText, rerender } = render(
      <BarangayReportsTable rows={rows} insight={insight} canExport />
    );
    await user.selectOptions(getByLabelText("Filter by category"), "Sanitation");

    rerender(<BarangayReportsTable rows={[]} insight={insight} canExport={false} />);

    expect(getTableBody(container)).toHaveTextContent("No reports in this range.");
    expect(getTableBody(container)).not.toHaveTextContent("as its top category");
  });

  it("names the category when the range has reports but none has it as the top category", async () => {
    const user = userEvent.setup();
    const { container, getByLabelText, rerender } = render(
      <BarangayReportsTable rows={rows} insight={insight} canExport />
    );
    await user.selectOptions(getByLabelText("Filter by category"), "Sanitation");

    // New range: still has reports, but no barangay tops out on Sanitation.
    rerender(<BarangayReportsTable rows={[rows[0]]} insight={insight} canExport />);

    expect(getTableBody(container)).toHaveTextContent("No barangay has Sanitation as its top category.");
    expect(getTableBody(container)).not.toHaveTextContent("No reports in this range.");
  });

  it("shows the rows and no empty-state message when the range has reports under All categories", () => {
    const { container } = render(<BarangayReportsTable rows={rows} insight={insight} canExport />);

    expect(within(getTableBody(container)).getAllByRole("row")).toHaveLength(2);
    expect(getTableBody(container)).not.toHaveTextContent("No reports in this range.");
    expect(getTableBody(container)).not.toHaveTextContent("as its top category");
  });
});
