import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ServiceWorker } from "./service-worker";

afterEach(() => {
  vi.unstubAllEnvs();
  // jsdom has no serviceWorker; each test adds its own.
  Reflect.deleteProperty(navigator, "serviceWorker");
});

function stubServiceWorker() {
  const register = vi.fn().mockResolvedValue({});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
  return register;
}

describe("ServiceWorker", () => {
  it("registers the Responder worker, scoped to the Responder Portal", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = stubServiceWorker();

    render(<ServiceWorker />);

    expect(register).toHaveBeenCalledWith("/responder/sw.js", { scope: "/responder/" });
  });

  // A worker in `next dev` outlives the code it was built from and gets in
  // the way of hot reload.
  it("stays out of development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = stubServiceWorker();

    render(<ServiceWorker />);

    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing in a browser without service workers", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => render(<ServiceWorker />)).not.toThrow();
  });
});
