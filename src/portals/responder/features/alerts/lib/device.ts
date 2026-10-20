import { createClient } from "@/shared/supabase/client";
import { vapidKeyBytes } from "@/portals/responder/features/alerts/lib/support";

/**
 * THIS device's sign-up for Phone alerts (ADR 0001, SCRUM-162; DB layer l76).
 *
 * The browser's PushSubscription is the device; push_subscriptions holds one
 * row per endpoint, owned by one responder. The Portal writes it only through
 * register_push_subscription / delete_my_push_subscription and reads it only
 * through my_push_subscriptions, which shows the caller's own devices.
 */

const SW_URL = "/responder/sw.js";
const SCOPE = "/responder/";

export type SignUpResult = "on" | "blocked" | "dismissed" | "failed";

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration(SCOPE);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * On for this responder only if the database holds this endpoint as theirs.
 * A subscription left by the previous user of a shared phone is not theirs.
 * Throws when the database cannot answer: "don't know" is not "off".
 */
export async function isSignedUp(endpoint: string): Promise<boolean> {
  const { data, error } = await createClient()
    .from("my_push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) throw new Error(`my_push_subscriptions: ${error.message}`);
  return data !== null;
}

/** Must run inside a tap: browsers ask for permission only from a user gesture. */
export async function signUpDevice(vapidKey: string): Promise<SignUpResult> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "dismissed";

  try {
    // register() returns the existing registration when there is one; ready
    // waits for it to be active, which subscribe() needs.
    await navigator.serviceWorker.register(SW_URL, { scope: SCOPE });
    const reg = await navigator.serviceWorker.ready;
    const sub = await subscribe(reg, vapidKey);

    const { keys } = sub.toJSON();
    const { error } = await createClient().rpc("register_push_subscription", {
      p_endpoint: sub.endpoint,
      p_p256dh: keys?.p256dh ?? "",
      p_auth: keys?.auth ?? "",
      p_user_agent: navigator.userAgent,
    });
    return error ? "failed" : "on";
  } catch {
    return "failed";
  }
}

// A subscription made under another VAPID key cannot be reached with this one,
// and subscribe() refuses to replace it, so it is dropped and made again.
async function subscribe(
  reg: ServiceWorkerRegistration,
  vapidKey: string,
): Promise<PushSubscription> {
  const options = {
    userVisibleOnly: true,
    applicationServerKey: vapidKeyBytes(vapidKey),
  };
  try {
    return await reg.pushManager.subscribe(options);
  } catch (e) {
    // Only the key mismatch is InvalidStateError. Anything else (network,
    // push service) must not throw away a subscription that may be working.
    if (!(e instanceof DOMException && e.name === "InvalidStateError")) throw e;
    const stale = await reg.pushManager.getSubscription();
    if (!stale) throw e;
    await stale.unsubscribe();
    return reg.pushManager.subscribe(options);
  }
}

/**
 * Deletes this device's row for the signed-in responder. Needs the session, so
 * it runs BEFORE auth.signOut(). Never throws: sign-out must not fail because
 * of an alert, and delete_my_push_subscription answers false, not an error,
 * when a 410 already removed the row.
 */
export async function forgetDevice(): Promise<void> {
  try {
    await deleteRow();
  } catch {
    // Best effort. unsubscribeDevice() below still silences the phone.
  }
}

/**
 * Kills the endpoint in the browser, so the push service answers 410 and the
 * sender deletes any row that survived forgetDevice(). Never throws.
 */
export async function unsubscribeDevice(): Promise<void> {
  try {
    await (await currentSubscription())?.unsubscribe();
  } catch {
    // Nothing left to do from here.
  }
}

/** "Turn off": the database row first (it needs the session), then the browser. */
export async function turnOffDevice(): Promise<boolean> {
  if (!(await deleteRow())) return false;
  await unsubscribeDevice();
  return true;
}

/** This device's row, deleted for the caller. True when nothing is left of it. */
async function deleteRow(): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub) return true;
  const { error } = await createClient().rpc("delete_my_push_subscription", {
    p_endpoint: sub.endpoint,
  });
  return !error;
}
