import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// @testing-library/dom's waitFor/findBy* implementation (dist/wait-for.js)
// only knows how to drive fake timers via a global `jest` object — it
// detects fake timers generically (checking for a `.clock` property that
// @sinonjs/fake-timers, the engine behind both Jest's and Vitest's fake
// timers, attaches to the patched `setTimeout`), but then unconditionally
// calls `jest.advanceTimersByTime(...)` to pump them. Under Vitest there is
// no `jest` global, so without this shim that call throws inside an
// unawaited async executor and waitFor/findBy* hang until the test's own
// timeout — every test in this suite that combines vi.useFakeTimers() with
// screen.findByText()/waitFor() (there are many) depends on this. See
// https://github.com/testing-library/dom-testing-library/blob/main/src/wait-for.js
// for the detection/advance logic this satisfies.
if (typeof (globalThis as { jest?: unknown }).jest === "undefined") {
  (globalThis as { jest?: { advanceTimersByTime: (ms: number) => void } }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  };
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

// jsdom has no layout engine, so getBoundingClientRect() always returns a
// zero rect. Recharts' ResponsiveContainer reads this on mount to size
// itself and renders nothing if the size is non-positive. Give it a
// reasonable non-zero size so charts render in tests.
if (typeof Element !== "undefined") {
  Element.prototype.getBoundingClientRect = () => ({
    width: 800,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 800,
    x: 0,
    y: 0,
    toJSON() {},
  });
}
