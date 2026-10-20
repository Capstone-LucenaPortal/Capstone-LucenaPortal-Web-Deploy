import { describe, expect, it } from "vitest";
import {
  alertSupport,
  isIOS,
  vapidKeyBytes,
  type AlertEnvironment,
} from "@/portals/responder/features/alerts/lib/support";

const ANDROID: AlertEnvironment = {
  vapidKey: "BKey",
  production: true,
  serviceWorker: true,
  pushManager: true,
  permission: "default",
  ios: false,
  standalone: false,
};

describe("alertSupport", () => {
  it("is ready on a browser that can take alerts", () => {
    expect(alertSupport(ANDROID)).toBe("ready");
    expect(alertSupport({ ...ANDROID, permission: "granted" })).toBe("ready");
  });

  // Decision 11 / .env.example: no public key means this deployment cannot
  // sign a device up. The service worker is production-only, so dev is the
  // same case.
  it("is unavailable without a VAPID key or outside a production build", () => {
    expect(alertSupport({ ...ANDROID, vapidKey: "" })).toBe("unavailable");
    expect(alertSupport({ ...ANDROID, production: false })).toBe("unavailable");
  });

  // iOS 16.4+ gives web push only to a Portal opened from the Home Screen.
  it("asks an iPhone in the browser to add the Portal to the Home Screen first", () => {
    const safari = { ...ANDROID, ios: true, pushManager: false, permission: null };
    expect(alertSupport(safari)).toBe("needs-install");
    expect(alertSupport({ ...ANDROID, ios: true, standalone: true })).toBe("ready");
  });

  it("is unsupported where the browser lacks push", () => {
    expect(alertSupport({ ...ANDROID, pushManager: false })).toBe("unsupported");
    expect(alertSupport({ ...ANDROID, serviceWorker: false })).toBe("unsupported");
    expect(alertSupport({ ...ANDROID, permission: null })).toBe("unsupported");
  });

  it("is blocked once the responder has refused notifications for the site", () => {
    expect(alertSupport({ ...ANDROID, permission: "denied" })).toBe("blocked");
  });
});

describe("isIOS", () => {
  it("knows an iPhone, and an iPad that calls itself a Mac", () => {
    expect(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)", "iPhone", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(isIOS("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5)).toBe(false);
  });
});

describe("vapidKeyBytes", () => {
  it("decodes the base64url public key pushManager.subscribe() takes", () => {
    // "AQID_-8" is base64url for bytes 01 02 03 ff ef.
    expect(Array.from(vapidKeyBytes("AQID_-8"))).toEqual([1, 2, 3, 0xff, 0xef]);
  });
});
