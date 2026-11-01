import { describe, expect, it, vi } from "vitest";
import MonitoringPage from "./page";

const redirectMock = vi.fn((path: string) => {
  // The real redirect() never returns: it throws to end the render.
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

describe("/super-staff/monitoring", () => {
  it("sends old links on to System Health", () => {
    expect(() => MonitoringPage()).toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/super-staff/system-health");
  });
});
