// src/portals/admin/features/yellow-card/components/barangay-coverage-table.test.tsx
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarangayCoverageTable } from "@/portals/admin/features/yellow-card/components/barangay-coverage-table";
import type { BarangayCoverage } from "@/portals/admin/features/yellow-card/types";

const rows: BarangayCoverage[] = [
  { barangay: "Barangay One", approved: 5, pending: 2, rejected: 1 },
  { barangay: "Barangay Two", approved: 1, pending: 0, rejected: 0 },
];

// Both sortable <th>s in this table's header row, in document order:
// [0] Barangay, [1] Applicants (colSpan 2). There is no non-sortable column
// in this table (unlike BarangayReportsTable's "Top Category").
function getHeaders(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("thead th"));
}

describe("BarangayCoverageTable aria-sort", () => {
  it("defaults to Applicants sorted descending, Barangay unsorted", () => {
    const { container } = render(<BarangayCoverageTable rows={rows} />);
    const [barangayTh, applicantsTh] = getHeaders(container);

    // Matches the component's initial state: useState<SortKey>("applicants"),
    // useState<SortDir>("desc").
    expect(barangayTh).toHaveAttribute("aria-sort", "none");
    expect(applicantsTh).toHaveAttribute("aria-sort", "descending");
  });

  it("clicking the inactive Barangay header sorts it ascending and resets Applicants to none", async () => {
    const user = userEvent.setup();
    const { container } = render(<BarangayCoverageTable rows={rows} />);
    const [barangayTh, applicantsTh] = getHeaders(container);

    await user.click(within(barangayTh).getByRole("button"));

    expect(barangayTh).toHaveAttribute("aria-sort", "ascending");
    expect(applicantsTh).toHaveAttribute("aria-sort", "none");
  });

  it("clicking the already-active Barangay header toggles ascending then descending", async () => {
    const user = userEvent.setup();
    const { container } = render(<BarangayCoverageTable rows={rows} />);
    const [barangayTh] = getHeaders(container);
    const barangayButton = within(barangayTh).getByRole("button");

    await user.click(barangayButton); // inactive -> ascending (first click on a newly-active column)
    expect(barangayTh).toHaveAttribute("aria-sort", "ascending");

    await user.click(barangayButton); // active -> toggles to descending
    expect(barangayTh).toHaveAttribute("aria-sort", "descending");

    await user.click(barangayButton); // active -> toggles back to ascending
    expect(barangayTh).toHaveAttribute("aria-sort", "ascending");
  });

  it("clicking the already-active Applicants header toggles descending then ascending", async () => {
    const user = userEvent.setup();
    const { container } = render(<BarangayCoverageTable rows={rows} />);
    const [, applicantsTh] = getHeaders(container);
    const applicantsButton = within(applicantsTh).getByRole("button");

    expect(applicantsTh).toHaveAttribute("aria-sort", "descending");

    await user.click(applicantsButton); // active -> toggles to ascending
    expect(applicantsTh).toHaveAttribute("aria-sort", "ascending");

    await user.click(applicantsButton); // active -> toggles back to descending
    expect(applicantsTh).toHaveAttribute("aria-sort", "descending");
  });
});
