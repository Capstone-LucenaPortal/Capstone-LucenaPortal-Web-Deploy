import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import type { SuperAccountRow } from "../lib/account-row";
import { AccountsListView } from "./accounts-list-view";

const SIGNED_IN_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";

const row = (over: Partial<SuperAccountRow>): SuperAccountRow => ({
  id: null,
  full_name: null,
  email: null,
  role: "staff",
  modules: [],
  is_supervisor: false,
  status: "active",
  department_code: null,
  department_label: null,
  phone: null,
  employee_id: null,
  created_at: "2026-10-01T00:00:00Z",
  last_change_at: "2026-10-01T00:00:00Z",
  invited_at: null,
  last_sign_in_at: null,
  ...over,
});

const ROWS = [
  row({
    id: SIGNED_IN_ID,
    full_name: "Maria Santos",
    email: "maria.santos@lucenacity.gov.ph",
    role: "super_staff",
  }),
  row({
    id: OTHER_ID,
    full_name: "Juan Dela Cruz",
    email: "juan.delacruz@lucenacity.gov.ph",
  }),
];

const invoke = vi.fn();

// The view reads super_accounts and the session cookie, and calls the
// staff-accounts Edge Function. Each is stubbed at the client.
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: ROWS, error: null }),
      }),
    }),
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: SIGNED_IN_ID } } },
        }),
    },
    functions: { invoke },
  }),
}));

afterEach(() => {
  invoke.mockReset();
});

function renderAccounts() {
  return render(
    <ToastProvider>
      <AccountsListView />
    </ToastProvider>,
  );
}

async function rowOf(name: string) {
  return (await screen.findByText(name)).closest("tr") as HTMLElement;
}

describe("AccountsListView — Reset authenticator", () => {
  it("offers Reset authenticator on every row but the signed-in Super-staff's own", async () => {
    renderAccounts();

    const other = await rowOf("Juan Dela Cruz");
    expect(
      within(other).getByRole("button", { name: "Reset authenticator" }),
    ).toBeInTheDocument();

    const own = await rowOf("Maria Santos");
    expect(
      within(own).queryByRole("button", { name: "Reset authenticator" }),
    ).not.toBeInTheDocument();
  });

  it("asks first, naming the account, and Cancel resets nothing", async () => {
    const user = userEvent.setup();
    renderAccounts();

    await user.click(
      within(await rowOf("Juan Dela Cruz")).getByRole("button", {
        name: "Reset authenticator",
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Juan Dela Cruz/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/juan\.delacruz@lucenacity\.gov\.ph/),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  // supabase-js reports a non-2xx as a generic error whose context is the
  // Response; the function's own message is in that Response's JSON body.
  const refusal = (
    status: number,
    error: string,
    extra: Record<string, unknown> = {},
  ) => ({
    data: null,
    error: {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify({ error, ...extra }), { status }),
    },
  });

  it.each([
    [
      "the reset",
      {
        data: {
          reset: true,
          recorded: true,
          email: "juan.delacruz@lucenacity.gov.ph",
          removed: 1,
        },
        error: null,
      },
      /they'll set up a new one at their next sign-in/i,
      "closed",
    ],
    [
      "a refusal",
      refusal(403, "Only an active Super Staff can do this."),
      /Only an active Super Staff can do this\./,
      "open",
    ],
    [
      "a reset that could not be recorded",
      refusal(
        500,
        "The authenticator was reset but could not be recorded: timeout",
        {
          reset: true,
          recorded: false,
          email: "juan.delacruz@lucenacity.gov.ph",
          removed: 1,
        },
      ),
      /reset but could not be recorded: timeout/,
      // The reset stands: a second confirm would only be told there is no
      // authenticator to reset.
      "closed",
    ],
  ])("on confirm, reports %s", async (_outcome, response, message, dialog) => {
    invoke.mockResolvedValue(response);
    const user = userEvent.setup();
    renderAccounts();

    await user.click(
      within(await rowOf("Juan Dela Cruz")).getByRole("button", {
        name: "Reset authenticator",
      }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reset authenticator",
      }),
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
    if (dialog === "closed") {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    }
    expect(invoke).toHaveBeenCalledWith("staff-accounts", {
      body: { action: "reset-authenticator", id: OTHER_ID },
    });
  });
});
