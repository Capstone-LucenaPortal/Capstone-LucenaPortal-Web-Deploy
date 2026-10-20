import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveCell, CatalogRow } from "./catalog-card";

// The row actions and the Inactive badge are ALWAYS rendered, and only made
// invisible when absent, so the table's auto layout reserves their width and
// the columns do not jump when a row turns dirty or inactive. jsdom cannot
// measure that layout; what it can check is that the reserved-but-invisible
// copies never leak to assistive tech.

function row(dirty: boolean) {
  return render(
    <table>
      <tbody>
        <CatalogRow dirty={dirty} saving={false} onSave={() => {}} onRevert={() => {}}>
          <td>cell</td>
        </CatalogRow>
      </tbody>
    </table>,
  );
}

function activeCell(checked: boolean) {
  return render(
    <table>
      <tbody>
        <tr>
          <ActiveCell rowKey="doc_x" checked={checked} onChange={() => {}} />
        </tr>
      </tbody>
    </table>,
  );
}

describe("CatalogRow", () => {
  it("hides Save and Revert from assistive tech while the row is clean", () => {
    row(false);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revert" })).toBeNull();
  });

  it("offers Save and Revert once the row is dirty", () => {
    row(true);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Revert" })).toBeEnabled();
  });

  it("names the save button Saving… while a save is in flight", () => {
    render(
      <table>
        <tbody>
          <CatalogRow dirty saving onSave={() => {}} onRevert={() => {}}>
            <td>cell</td>
          </CatalogRow>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("keeps the clean row's buttons disabled, so nothing can fire them", () => {
    const { container } = row(false);
    for (const b of container.querySelectorAll("button")) {
      expect(b).toBeDisabled();
    }
  });
});

// jsdom loads no Tailwind, so `invisible` does nothing here — aria-hidden is
// the half of the reservation a test can see.
const hiddenFromAT = (el: HTMLElement) => el.closest('[aria-hidden="true"]') !== null;

describe("ActiveCell", () => {
  it("does not announce Inactive for an active row", () => {
    activeCell(true);
    expect(hiddenFromAT(screen.getByText("Inactive"))).toBe(true);
  });

  it("announces Inactive for an inactive row", () => {
    activeCell(false);
    expect(hiddenFromAT(screen.getByText("Inactive"))).toBe(false);
  });
});
