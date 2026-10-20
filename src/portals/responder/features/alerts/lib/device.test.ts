import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetDevice,
  isSignedUp,
  signUpDevice,
  turnOffDevice,
  unsubscribeDevice,
} from "@/portals/responder/features/alerts/lib/device";

const rpc = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ rpc, from }),
}));

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

function fakeSubscription() {
  return {
    endpoint: ENDPOINT,
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "pk", auth: "ak" } }),
  };
}

let sub: ReturnType<typeof fakeSubscription> | null;
const pushManager = {
  getSubscription: vi.fn(async () => sub),
  subscribe: vi.fn(),
};
const reg = { pushManager };
const requestPermission = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  sub = null;
  pushManager.subscribe.mockImplementation(async () => {
    sub = fakeSubscription();
    return sub;
  });
  rpc.mockResolvedValue({ data: true, error: null });
  vi.stubGlobal("Notification", { requestPermission, permission: "default" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(reg),
      ready: Promise.resolve(reg),
      getRegistration: vi.fn().mockResolvedValue(reg),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signUpDevice", () => {
  it("subscribes this device and registers it as the responder's", async () => {
    requestPermission.mockResolvedValue("granted");

    expect(await signUpDevice("AQID")).toBe("on");

    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(rpc).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: ENDPOINT,
      p_p256dh: "pk",
      p_auth: "ak",
      p_user_agent: navigator.userAgent,
    });
  });

  it("stops at the permission prompt when the responder refuses or dismisses it", async () => {
    requestPermission.mockResolvedValue("denied");
    expect(await signUpDevice("AQID")).toBe("blocked");

    requestPermission.mockResolvedValue("default");
    expect(await signUpDevice("AQID")).toBe("dismissed");

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails when the database refuses the device", async () => {
    requestPermission.mockResolvedValue("granted");
    rpc.mockResolvedValue({ data: null, error: { code: "22023" } });

    expect(await signUpDevice("AQID")).toBe("failed");
  });

  // A subscription made under an older VAPID key cannot be reached with the
  // new one, and subscribe() will not replace it on its own.
  it("replaces a subscription made under another key", async () => {
    requestPermission.mockResolvedValue("granted");
    const stale = fakeSubscription();
    sub = stale;
    pushManager.subscribe
      .mockRejectedValueOnce(new DOMException("key mismatch", "InvalidStateError"));

    expect(await signUpDevice("AQID")).toBe("on");
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledTimes(2);
  });
});

describe("isSignedUp", () => {
  it("is true only when the database holds this endpoint as the caller's", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "d1" }, error: null });
    expect(await isSignedUp(ENDPOINT)).toBe(true);
    expect(from).toHaveBeenCalledWith("my_push_subscriptions");
    expect(eq).toHaveBeenCalledWith("endpoint", ENDPOINT);

    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await isSignedUp(ENDPOINT)).toBe(false);
  });
});

describe("sign-out", () => {
  it("forgetDevice deletes this device's row and leaves the browser subscription", async () => {
    sub = fakeSubscription();

    await forgetDevice();

    expect(rpc).toHaveBeenCalledWith("delete_my_push_subscription", {
      p_endpoint: ENDPOINT,
    });
    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });

  it("forgetDevice never throws, so sign-out cannot fail because of it", async () => {
    sub = fakeSubscription();
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(forgetDevice()).resolves.toBeUndefined();
  });

  it("forgetDevice does nothing on a device that never signed up", async () => {
    await forgetDevice();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("unsubscribeDevice silences the phone and never throws", async () => {
    sub = fakeSubscription();
    await unsubscribeDevice();
    expect(sub.unsubscribe).toHaveBeenCalled();

    sub.unsubscribe.mockRejectedValue(new Error("gone"));
    await expect(unsubscribeDevice()).resolves.toBeUndefined();
  });
});

describe("turnOffDevice", () => {
  it("deletes the row, then unsubscribes the browser", async () => {
    sub = fakeSubscription();
    const browserSub = sub;

    expect(await turnOffDevice()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("delete_my_push_subscription", {
      p_endpoint: ENDPOINT,
    });
    expect(browserSub.unsubscribe).toHaveBeenCalled();
  });

  // Unsubscribing after a failed delete would leave a row the sender keeps
  // trying, and an "off" switch the database does not agree with.
  it("keeps the browser subscription when the database delete fails", async () => {
    sub = fakeSubscription();
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });

    expect(await turnOffDevice()).toBe(false);
    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });
});

describe("review fixes", () => {
  it("isSignedUp throws when the database cannot answer, rather than saying off", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(isSignedUp(ENDPOINT)).rejects.toThrow(/offline/);
  });

  // Only a key mismatch (InvalidStateError) justifies dropping the existing
  // subscription; a network failure must leave a working one alone.
  it("keeps the existing subscription when subscribe() fails for any other reason", async () => {
    requestPermission.mockResolvedValue("granted");
    const working = fakeSubscription();
    sub = working;
    pushManager.subscribe.mockRejectedValueOnce(new DOMException("network", "AbortError"));

    expect(await signUpDevice("AQID")).toBe("failed");
    expect(working.unsubscribe).not.toHaveBeenCalled();
  });
});
