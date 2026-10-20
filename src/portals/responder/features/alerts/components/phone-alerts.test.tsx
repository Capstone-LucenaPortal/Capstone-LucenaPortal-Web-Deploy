import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  dutyLine,
  PhoneAlertsBanner,
  PhoneAlertsSetting,
} from "@/portals/responder/features/alerts/components/phone-alerts";
import { PhoneAlertsProvider, usePhoneAlerts } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";
import type { AlertEnvironment } from "@/portals/responder/features/alerts/lib/support";

/**
 * The browser and the database are faked at the two seams the provider reads
 * through — the environment snapshot and lib/device — so these tests drive the
 * real decision in alertSupport().
 */
const env = vi.hoisted(() => ({ current: {} as AlertEnvironment }));
const device = vi.hoisted(() => ({
  currentSubscription: vi.fn(),
  isSignedUp: vi.fn(),
  signUpDevice: vi.fn(),
  turnOffDevice: vi.fn(),
}));
const showToast = vi.fn();

vi.mock("@/portals/responder/features/alerts/lib/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/portals/responder/features/alerts/lib/support")>()),
  readEnvironment: () => env.current,
}));
vi.mock("@/portals/responder/features/alerts/lib/device", () => device);
vi.mock("@/portals/responder/components/ui/toast", () => ({
  useToast: () => ({ showToast }),
}));

const READY: AlertEnvironment = {
  vapidKey: "BKey",
  production: true,
  serviceWorker: true,
  pushManager: true,
  permission: "default",
  ios: false,
  standalone: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  env.current = READY;
  device.currentSubscription.mockResolvedValue(null);
  device.isSignedUp.mockResolvedValue(false);
});

function renderWith(ui: React.ReactNode) {
  return render(<PhoneAlertsProvider>{ui}</PhoneAlertsProvider>);
}

describe("PhoneAlertsSetting", () => {
  it("offers to turn alerts on when this device is not signed up, and never says push", async () => {
    renderWith(<PhoneAlertsSetting onDuty />);

    expect(
      await screen.findByRole("button", { name: "Turn on phone alerts" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/push/i)).not.toBeInTheDocument();
  });

  it("says alerts are on once the database holds this device as the responder's", async () => {
    device.currentSubscription.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x" });
    device.isSignedUp.mockResolvedValue(true);

    renderWith(<PhoneAlertsSetting onDuty />);

    expect(
      await screen.findByText(/Phone alerts are on for this phone\. New pool work rings it/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn off phone alerts" })).toBeInTheDocument();
  });

  // A shared phone still subscribed by the previous responder is not "on"
  // for whoever is signed in now.
  it("treats someone else's subscription on this phone as off", async () => {
    device.currentSubscription.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x" });
    device.isSignedUp.mockResolvedValue(false);

    renderWith(<PhoneAlertsSetting onDuty />);

    expect(
      await screen.findByRole("button", { name: "Turn on phone alerts" }),
    ).toBeInTheDocument();
  });

  it("says alerts are paused while off duty", async () => {
    device.currentSubscription.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x" });
    device.isSignedUp.mockResolvedValue(true);

    renderWith(<PhoneAlertsSetting onDuty={false} />);

    expect(
      await screen.findByText("Phone alerts are on for this phone, and paused while you're off duty."),
    ).toBeInTheDocument();
  });

  it("turns alerts on from the tap and says so", async () => {
    device.signUpDevice.mockResolvedValue("on");
    renderWith(<PhoneAlertsSetting onDuty />);

    fireEvent.click(await screen.findByRole("button", { name: "Turn on phone alerts" }));

    expect(await screen.findByRole("button", { name: "Turn off phone alerts" })).toBeInTheDocument();
    expect(device.signUpDevice).toHaveBeenCalledWith("BKey");
    expect(showToast).toHaveBeenCalledWith("Phone alerts are on for this phone.");
  });

  it("explains how to unblock when the responder refuses the prompt", async () => {
    device.signUpDevice.mockResolvedValue("blocked");
    renderWith(<PhoneAlertsSetting onDuty />);

    fireEvent.click(await screen.findByRole("button", { name: "Turn on phone alerts" }));

    expect(await screen.findByText(/Phone alerts are blocked for this site/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the button and raises a toast when signing up fails", async () => {
    device.signUpDevice.mockResolvedValue("failed");
    renderWith(<PhoneAlertsSetting onDuty />);

    fireEvent.click(await screen.findByRole("button", { name: "Turn on phone alerts" }));

    expect(await screen.findByRole("button", { name: "Turn on phone alerts" })).toBeEnabled();
    expect(showToast).toHaveBeenCalledWith("Could not turn on phone alerts. Try again.");
  });

  it("turns alerts off", async () => {
    device.currentSubscription.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x" });
    device.isSignedUp.mockResolvedValue(true);
    device.turnOffDevice.mockResolvedValue(true);
    renderWith(<PhoneAlertsSetting onDuty />);

    fireEvent.click(await screen.findByRole("button", { name: "Turn off phone alerts" }));

    expect(await screen.findByRole("button", { name: "Turn on phone alerts" })).toBeInTheDocument();
  });

  it("walks an iPhone in Safari through Add to Home Screen first", async () => {
    env.current = { ...READY, ios: true, pushManager: false, permission: null };
    renderWith(<PhoneAlertsSetting onDuty />);

    expect(await screen.findByText(/only from the Home Screen/)).toBeInTheDocument();
    expect(screen.getByText("Tap Add to Home Screen.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // No VAPID key on this deployment: nothing can sign up, so the Inbox is the
  // only channel and the profile keeps saying so.
  it("says alerts are coming where this deployment has no key", async () => {
    env.current = { ...READY, vapidKey: "" };
    renderWith(<PhoneAlertsSetting onDuty />);

    expect(
      await screen.findByText(
        "Phone alerts are coming. Until then, new pool work shows only in your Inbox, so open the app to check.",
      ),
    ).toBeInTheDocument();
    expect(device.currentSubscription).not.toHaveBeenCalled();
  });
});

describe("PhoneAlertsBanner", () => {
  it("offers alerts on the pool while this device is not signed up", async () => {
    device.signUpDevice.mockResolvedValue("on");
    renderWith(<PhoneAlertsBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));

    expect(device.signUpDevice).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument(),
    );
  });

  it("points an iPhone in Safari to the profile's steps", async () => {
    env.current = { ...READY, ios: true, pushManager: false, permission: null };
    renderWith(<PhoneAlertsBanner />);

    expect(await screen.findByRole("link", { name: "How" })).toHaveAttribute(
      "href",
      "/responder/profile",
    );
  });

  it("is gone once alerts are on, and where they cannot be offered", async () => {
    device.currentSubscription.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x" });
    device.isSignedUp.mockResolvedValue(true);
    const { container, unmount } = renderWith(<PhoneAlertsBanner />);
    await vi.waitFor(() => expect(device.isSignedUp).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();

    env.current = { ...READY, permission: "denied" };
    const blocked = renderWith(<PhoneAlertsBanner />);
    expect(blocked.container).toBeEmptyDOMElement();
  });
});

describe("dutyLine", () => {
  it("adds this device's alerts to the headcount", () => {
    expect(dutyLine(true, "on")).toBe("Counted · alerts on");
    expect(dutyLine(true, "off")).toBe("Counted · alerts off");
    expect(dutyLine(true, "blocked")).toBe("Counted · alerts off");
    expect(dutyLine(false, "on")).toBe("Not counted · alerts paused");
    expect(dutyLine(false, "off")).toBe("Not counted");
  });

  it("says only the headcount until alerts are known or where none can exist", () => {
    expect(dutyLine(true, "loading")).toBe("Counted in shift");
    expect(dutyLine(true, "unavailable")).toBe("Counted in shift");
  });
});

describe("review fixes", () => {
  // Offline is "don't know", not "off": no banner telling a signed-up
  // responder their phone is silent.
  it("shows neither banner nor button when the database cannot say", async () => {
    device.currentSubscription.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x" });
    device.isSignedUp.mockRejectedValue(new Error("offline"));
    const { container } = renderWith(<PhoneAlertsBanner />);

    await vi.waitFor(() => expect(device.isSignedUp).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  // Two taps inside one render both see pending=false; the guard is a ref.
  it("starts one sign-up for two taps inside one render", async () => {
    let finish: (r: string) => void = () => {};
    device.signUpDevice.mockImplementation(() => new Promise((r) => (finish = r)));
    function DoubleTap() {
      const { status, turnOn } = usePhoneAlerts();
      return (
        <button type="button" onClick={() => { void turnOn(); void turnOn(); }}>
          {status}
        </button>
      );
    }
    renderWith(<DoubleTap />);

    fireEvent.click(await screen.findByRole("button", { name: "off" }));
    finish("on");

    await screen.findByRole("button", { name: "on" });
    expect(device.signUpDevice).toHaveBeenCalledTimes(1);
  });
});
