import { describe, expect, it } from "vitest";
import { plainRpcError } from "./rpc-error";

describe("plainRpcError", () => {
  it("drops update_staff_account's prefix and capitalizes the rest", () => {
    expect(
      plainRpcError("update_staff_account: you cannot change your own role"),
    ).toBe("You cannot change your own role");
  });

  it("drops set_staff_account_status's prefix and capitalizes the rest", () => {
    expect(
      plainRpcError(
        "set_staff_account_status: you cannot deactivate your own account",
      ),
    ).toBe("You cannot deactivate your own account");
  });

  it("returns a message with no prefix unchanged", () => {
    expect(plainRpcError("A reason is required.")).toBe(
      "A reason is required.",
    );
  });

  it("drops only the leading prefix when the rest holds a colon", () => {
    expect(plainRpcError("update_staff_account: no staff account 1234: x")).toBe(
      "No staff account 1234: x",
    );
  });
});
