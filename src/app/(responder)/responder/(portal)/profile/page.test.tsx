import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ProfilePage from "@/app/(responder)/responder/(portal)/profile/page";
import { ToastProvider } from "@/portals/responder/components/ui/toast";
import { PhoneAlertsProvider } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";
import { SessionProvider } from "@/portals/responder/features/auth/hooks/use-session";
import type { ResponderUser } from "@/portals/responder/features/auth/types";

/**
 * Sign-out takes this phone off the responder's Phone alerts (ADR 0001,
 * decision 8): a shared department phone must not ring for whoever used it
 * last. The order matters — the row is deleted while the session still exists,
 * and the browser subscription is dropped only once the sign-out succeeded.
 */
const calls: string[] = [];
const signOut = vi.fn();
const replace = vi.fn();
const device = vi.hoisted(() => ({
  forgetDevice: vi.fn(),
  unsubscribeDevice: vi.fn(),
  currentSubscription: vi.fn(),
  isSignedUp: vi.fn(),
  signUpDevice: vi.fn(),
  turnOffDevice: vi.fn(),
}));

vi.mock("@/portals/responder/features/alerts/lib/device", () => device);
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut }, rpc: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/responder/profile",
}));

const RESPONDER: ResponderUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "juan@lucena.gov",
  full_name: "Juan Dela Cruz",
  role: "responder",
  department_code: "engineering",
  department_label: "Engineering",
  phone: "09171234501",
  employee_id: "LGU-2026-0501",
  on_duty: true,
  created_at: "2026-01-12T08:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  device.forgetDevice.mockImplementation(async () => void calls.push("forget"));
  device.unsubscribeDevice.mockImplementation(async () => void calls.push("unsubscribe"));
  signOut.mockImplementation(async () => {
    calls.push("signOut");
    return { error: null };
  });
});

function renderProfile() {
  return render(
    <ToastProvider>
      <SessionProvider responder={RESPONDER} duty={null}>
        <PhoneAlertsProvider>
          <ProfilePage />
        </PhoneAlertsProvider>
      </SessionProvider>
    </ToastProvider>,
  );
}

async function confirmSignOut() {
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  const sheet = await screen.findByRole("dialog");
  fireEvent.click(within(sheet).getByRole("button", { name: "Sign out" }));
}

describe("/responder/profile sign-out", () => {
  it("deletes this device's sign-up, signs out, then silences the phone", async () => {
    renderProfile();

    await confirmSignOut();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/responder/login"));
    expect(calls).toEqual(["forget", "signOut", "unsubscribe"]);
  });

  // The responder is still signed in, so the browser subscription stays: the
  // setting re-reads the device and offers to turn alerts back on.
  it("keeps the browser subscription when the sign-out itself fails", async () => {
    signOut.mockImplementation(async () => {
      calls.push("signOut");
      return { error: { message: "offline" } };
    });
    renderProfile();

    await confirmSignOut();

    expect(
      await screen.findByText("Could not sign you out. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(calls).toEqual(["forget", "signOut"]);
    expect(replace).not.toHaveBeenCalled();
  });
});
