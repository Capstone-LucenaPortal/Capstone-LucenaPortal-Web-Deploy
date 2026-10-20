import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { IdleTimeout } from "./idle-timeout";
import {
  IDLE_CHECK_INTERVAL_MS,
  IDLE_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE,
} from "@/portals/super-staff/lib/supabase/idle-timeout";

const signOut = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

const START = 1_800_000_000_000;

function lastActivity(): number {
  const match = document.cookie.match(new RegExp(`${LAST_ACTIVITY_COOKIE}=(\\d+)`));
  return match ? Number(match[1]) : NaN;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(START);
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
  document.cookie = `${LAST_ACTIVITY_COOKIE}=; Path=/; Max-Age=0`;
});

describe("IdleTimeout", () => {
  it("starts the idle clock when the portal mounts", () => {
    render(<IdleTimeout />);

    expect(lastActivity()).toBe(START);
  });

  it("moves the clock on real input", () => {
    render(<IdleTimeout />);
    vi.setSystemTime(START + 60_000);

    fireEvent.keyDown(document);

    expect(lastActivity()).toBe(START + 60_000);
  });

  it("does not count mouse movement as activity", () => {
    render(<IdleTimeout />);
    vi.setSystemTime(START + 60_000);

    fireEvent.mouseMove(document);

    expect(lastActivity()).toBe(START);
  });

  it("does not count leaving the tab as activity", () => {
    render(<IdleTimeout />);
    vi.setSystemTime(START + 60_000);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);

    fireEvent(document, new Event("visibilitychange"));

    expect(lastActivity()).toBe(START);
    vi.restoreAllMocks();
  });

  it("leaves an active session alone", async () => {
    render(<IdleTimeout />);

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });

    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs an idle tab out and sends it to the sign-in screen with the reason", async () => {
    render(<IdleTimeout />);

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + IDLE_CHECK_INTERVAL_MS);
    });

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(replace).toHaveBeenCalledWith("/super-staff/login?reason=idle");
    expect(refresh).toHaveBeenCalled();
  });

  // Coming back to a desk after the window closed: the click that wakes the
  // screen must end the session, not rescue it.
  it("ends the session on the first input after the window has closed", async () => {
    render(<IdleTimeout />);
    vi.setSystemTime(START + IDLE_TIMEOUT_MS + 1);

    await act(async () => {
      fireEvent.click(document);
    });

    expect(lastActivity()).toBe(START);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  // Another tab moving the shared clock keeps this one signed in.
  it("honours activity recorded by another tab", async () => {
    render(<IdleTimeout />);
    vi.setSystemTime(START + IDLE_TIMEOUT_MS - 1000);
    document.cookie = `${LAST_ACTIVITY_COOKIE}=${Date.now()}; Path=/`;

    await act(async () => {
      vi.advanceTimersByTime(IDLE_CHECK_INTERVAL_MS * 2);
    });

    expect(signOut).not.toHaveBeenCalled();
  });

  // The request guard refuses the next request on the stale clock anyway, so the
  // tab still leaves the portal when the revoke call fails.
  it("still leaves the portal when the sign-out call fails", async () => {
    signOut.mockResolvedValue({ error: { message: "network" } });
    render(<IdleTimeout />);

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + IDLE_CHECK_INTERVAL_MS);
    });

    expect(replace).toHaveBeenCalledWith("/super-staff/login?reason=idle");
  });

  it("signs out once, not once per tick", async () => {
    signOut.mockReturnValue(new Promise(() => {}));
    render(<IdleTimeout />);

    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + IDLE_CHECK_INTERVAL_MS * 5);
    });

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
