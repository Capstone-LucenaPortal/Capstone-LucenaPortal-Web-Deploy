import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortSelect } from "./sort-select";

function renderInForm(sort: "default" | "newest" | "oldest") {
  const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return new FormData(e.currentTarget).get("sort");
  });
  render(
    <form onSubmit={onSubmit}>
      <SortSelect sort={sort} />
    </form>,
  );
  return onSubmit;
}

describe("SortSelect", () => {
  it("offers Default, Newest submitted and Oldest submitted, showing the current one", () => {
    renderInForm("oldest");

    const select = screen.getByLabelText("Sort by");
    expect(
      Array.from((select as HTMLSelectElement).options).map((o) => o.textContent),
    ).toEqual(["Default", "Newest submitted", "Oldest submitted"]);
    expect(screen.getByRole("option", { name: "Oldest submitted" })).toHaveProperty(
      "selected",
      true,
    );
  });

  it("submits its form the moment the choice changes", async () => {
    const user = userEvent.setup();
    const onSubmit = renderInForm("default");

    await user.selectOptions(screen.getByLabelText("Sort by"), "Newest submitted");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.results[0].value).toBe("newest");
  });

  it("sends an empty sort for Default, which the page reads as Default", async () => {
    const user = userEvent.setup();
    const onSubmit = renderInForm("newest");

    await user.selectOptions(screen.getByLabelText("Sort by"), "Default");

    expect(onSubmit.mock.results[0].value).toBe("");
  });
});
