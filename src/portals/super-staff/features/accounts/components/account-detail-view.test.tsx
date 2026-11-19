import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import { UnsavedChangesProvider } from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import { AccountDetailView } from "./account-detail-view";

// Tested at the network: the supabase-js builder is real, so every read and
// RPC the screen makes goes through it. The fake stands in for PostgREST.

const ACCOUNT_ID = "22222222-2222-2222-2222-222222222222";

const ACCOUNT_ROW = {
  id: ACCOUNT_ID,
  full_name: "Juan Dela Cruz",
  email: "juan.delacruz@lucenacity.gov.ph",
  role: "responder",
  modules: [],
  is_supervisor: false,
  status: "active",
  department_code: "CDRRMO",
  department_label: "CDRRMO",
  phone: "09171234567",
  employee_id: "EMP-0042",
  created_at: "2026-10-01T00:00:00Z",
  last_change_at: "2026-10-01T00:00:00Z",
  invited_at: null,
  last_sign_in_at: null,
};

/** The row every read and RPC returns; a test may swap in another. */
let accountRow: Record<string, unknown>;
/** The `changes` of the audit row the RPC just wrote, as the read finds it. */
let newestChanges: unknown;
let auditReadFails: boolean;
let rpcs: string[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fakePostgrest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(String(input));
  const path = url.pathname.replace("/rest/v1/", "");

  if (path.startsWith("rpc/")) {
    rpcs.push(path.slice("rpc/".length));
    return json(accountRow);
  }
  if (path === "super_accounts") {
    if (init?.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": "0-0/1" },
      });
    }
    return json([accountRow]);
  }
  if (path === "super_audit_log") {
    // The History card reads the whole history; the toast reads one row.
    if (url.searchParams.get("select") !== "changes") return json([]);
    if (auditReadFails) {
      return json({ code: "42501", message: "not an active Super-staff" }, 403);
    }
    return json([{ changes: newestChanges }]);
  }
  return json([]);
}

// One client, as the browser has: each new one would warn about sharing GoTrue
// storage.
let client: ReturnType<typeof createSupabaseClient> | undefined;
vi.mock("@/shared/supabase/client", () => ({
  createClient: () =>
    (client ??= createSupabaseClient("https://fake.supabase.co", "anon-key", {
      auth: { persistSession: false },
      global: { fetch: fakePostgrest },
    })),
}));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => `/super-staff/accounts/${ACCOUNT_ID}`,
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
  accountRow = ACCOUNT_ROW;
  newestChanges = { status: { from: "active", to: "inactive" } };
  auditReadFails = false;
  rpcs = [];
});

async function renderAccount() {
  render(
    <ToastProvider>
      <UnsavedChangesProvider>
        <AccountDetailView id={ACCOUNT_ID} />
      </UnsavedChangesProvider>
    </ToastProvider>,
  );
  await screen.findByRole("heading", { name: "Juan Dela Cruz" });
}

async function deactivate() {
  const user = userEvent.setup();
  await renderAccount();
  await user.click(screen.getByRole("button", { name: "Deactivate" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Reason"), "Transferred");
  await user.click(within(dialog).getByRole("button", { name: "Deactivate" }));
}

async function save() {
  const user = userEvent.setup();
  await renderAccount();
  await user.click(screen.getByRole("button", { name: "Save" }));
}

/** The one toast on screen. Asserting there is one rules out an error toast. */
async function theToast(): Promise<string | null> {
  await screen.findByRole("alert");
  const toasts = screen.getAllByRole("alert");
  expect(toasts).toHaveLength(1);
  return toasts[0].textContent;
}

describe("AccountDetailView — deactivating", () => {
  it("names the report the deactivation returned to the pool", async () => {
    newestChanges = {
      status: { from: "active", to: "inactive" },
      report_released: "INC-2026-000042",
    };

    await deactivate();

    expect(await theToast()).toBe(
      "Account deactivated. Report INC-2026-000042 went back to the department's pool.",
    );
    expect(rpcs).toEqual(["set_staff_account_status"]);
  });

  it("says only 'Account deactivated.' when no report was released", async () => {
    await deactivate();

    expect(await theToast()).toBe("Account deactivated.");
  });

  it("still says 'Account deactivated.', and nothing else, when the audit read fails", async () => {
    auditReadFails = true;

    await deactivate();

    expect(await theToast()).toBe("Account deactivated.");
  });
});

describe("AccountDetailView — saving", () => {
  it("names the report the save returned to the pool", async () => {
    newestChanges = {
      role: { from: "responder", to: "staff" },
      report_released: "INC-2026-000042",
    };

    await save();

    expect(await theToast()).toBe(
      "Changes saved. Report INC-2026-000042 went back to the department's pool.",
    );
    expect(rpcs).toEqual(["update_staff_account"]);
  });

  it("says only 'Changes saved.' when no report was released", async () => {
    newestChanges = { full_name: { from: "Juan", to: "Juan Dela Cruz" } };

    await save();

    expect(await theToast()).toBe("Changes saved.");
  });

  it("still says 'Changes saved.', and nothing else, when the audit read fails", async () => {
    auditReadFails = true;

    await save();

    expect(await theToast()).toBe("Changes saved.");
  });
});

describe("AccountDetailView — leaving with unsaved changes", () => {
  it("asks before Cancel discards an edit, and stays on the page", async () => {
    const user = userEvent.setup();
    await renderAccount();

    await user.type(screen.getByLabelText("Full name"), " Jr.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Discard unsaved changes?");
    expect(push).not.toHaveBeenCalled();
  });

  it("Keep editing stays on the page with the edit intact", async () => {
    const user = userEvent.setup();
    await renderAccount();

    await user.type(screen.getByLabelText("Full name"), " Jr.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Juan Dela Cruz Jr.");
    expect(push).not.toHaveBeenCalled();
  });

  it("Discard changes goes to the Accounts list", async () => {
    const user = userEvent.setup();
    await renderAccount();

    await user.type(screen.getByLabelText("Full name"), " Jr.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(push).toHaveBeenCalledExactlyOnceWith("/super-staff/accounts");
  });

  it("Cancel with no edits leaves at once", async () => {
    const user = userEvent.setup();
    await renderAccount();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledExactlyOnceWith("/super-staff/accounts");
  });

  it("Cancel leaves at once when a field is typed back to what was loaded", async () => {
    const user = userEvent.setup();
    await renderAccount();

    await user.type(screen.getByLabelText("Full name"), " Jr.");
    await user.type(screen.getByLabelText("Full name"), "{Backspace>4/}");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledExactlyOnceWith("/super-staff/accounts");
  });

  it("Cancel leaves at once when a module is unticked and ticked again", async () => {
    accountRow = {
      ...ACCOUNT_ROW,
      role: "staff",
      modules: ["yellow_card", "incidents"],
      department_code: null,
      department_label: null,
      phone: null,
      employee_id: null,
    };
    const user = userEvent.setup();
    await renderAccount();

    // Puts Yellow Card back at the end: same modules, another order.
    await user.click(screen.getByRole("checkbox", { name: "Yellow Card" }));
    await user.click(screen.getByRole("checkbox", { name: "Yellow Card" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledExactlyOnceWith("/super-staff/accounts");
  });

  it("Cancel leaves at once after a successful Save", async () => {
    const user = userEvent.setup();
    await renderAccount();

    await user.type(screen.getByLabelText("Full name"), " Jr.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await theToast()).toBe("Changes saved.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledExactlyOnceWith("/super-staff/accounts");
  });

  it("warns on reload or close only while the form is edited", async () => {
    const user = userEvent.setup();
    await renderAccount();
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);
    await user.type(screen.getByLabelText("Full name"), " Jr.");
    expect(unload()).toBe(true);
  });
});
