import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SubmitButton } from "./submit-button";

// One submission per file: React's form status is shared module state, and a
// transition from an earlier test skews the next one's.
describe("SubmitButton", () => {
  it("disables itself while its form's action is in flight", async () => {
    const action = () => new Promise<void>(() => {});
    render(
      <form action={action}>
        <SubmitButton>Resolve</SubmitButton>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Resolve" });
    expect(button).toBeEnabled();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("stays disabled when its caller disables it", () => {
    render(
      <form>
        <SubmitButton disabled>Send back</SubmitButton>
      </form>,
    );

    expect(screen.getByRole("button", { name: "Send back" })).toBeDisabled();
  });
});
