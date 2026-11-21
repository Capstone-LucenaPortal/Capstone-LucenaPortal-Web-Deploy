import { expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Six boxes say the code is six digits (#157): with the code step on screen,
 * types five digits and expects its button off, then the sixth and expects it
 * on. One check for every step that asks for a code (#159).
 */
export async function expectButtonWaitsForSixDigits(buttonName: string) {
  const field = await screen.findByLabelText("Authenticator code");
  const user = userEvent.setup({ delay: null });

  await user.type(field, "12345");
  expect(screen.getByRole("button", { name: buttonName })).toBeDisabled();
  await user.type(field, "6");
  expect(screen.getByRole("button", { name: buttonName })).toBeEnabled();
}
