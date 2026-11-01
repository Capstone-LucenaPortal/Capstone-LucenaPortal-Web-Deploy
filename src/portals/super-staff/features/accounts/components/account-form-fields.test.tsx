import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountFormFields, type AccountFormValue } from "./account-form-fields";

// Only a Responder reads departments; the Super Staff below never does.
vi.mock("@/shared/supabase/client", () => ({ createClient: vi.fn() }));

const value: AccountFormValue = {
  fullName: "Ana Reyes",
  email: "ana@lucena.gov",
  role: "Super Staff",
  modules: [],
  isSupervisor: false,
};

describe("AccountFormFields", () => {
  it("locks the Role select and says why on one's own account", () => {
    render(
      <AccountFormFields
        value={value}
        errors={{}}
        onChange={vi.fn()}
        emailReadOnly
        roleLocked
      />,
    );

    expect(screen.getByLabelText("Role")).toBeDisabled();
    expect(
      screen.getByText("You can't change your own role."),
    ).toBeInTheDocument();
  });

  it("leaves the Role select enabled on anyone else's account", () => {
    render(
      <AccountFormFields
        value={value}
        errors={{}}
        onChange={vi.fn()}
        emailReadOnly
      />,
    );

    expect(screen.getByLabelText("Role")).toBeEnabled();
    expect(
      screen.queryByText("You can't change your own role."),
    ).not.toBeInTheDocument();
  });
});
