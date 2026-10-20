import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSingleFlight } from "./use-single-flight";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function formData() {
  const data = new FormData();
  data.set("incidentId", "inc-1");
  return data;
}

// ISO-9: on a slow field connection a second tap must not double-act on an
// incident.
describe("useSingleFlight", () => {
  it("drops a second invocation while the first is in flight", async () => {
    const call = deferred();
    const action = vi.fn(() => call.promise);
    const { result } = renderHook(() => useSingleFlight(action));

    const first = result.current(formData());
    const second = result.current(formData());

    expect(action).toHaveBeenCalledTimes(1);
    await second;
    call.resolve();
    await first;
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("lets the next invocation through once the first has settled", async () => {
    const action = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useSingleFlight(action));

    await result.current(formData());
    await result.current(formData());

    expect(action).toHaveBeenCalledTimes(2);
  });

  // A server action that redirects REJECTS on the client, and Next's
  // RedirectBoundary needs that rejection to navigate. The guard must pass it
  // on — and still unlock, or a redirect back to the same page (resolve
  // without a photo opens the sheet on my-ticket) would leave a dead button.
  it("rethrows a rejection, and unlocks after it", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    const action = vi
      .fn<(data: FormData) => Promise<void>>()
      .mockRejectedValueOnce(redirect)
      .mockResolvedValueOnce();
    const { result } = renderHook(() => useSingleFlight(action));

    await expect(result.current(formData())).rejects.toBe(redirect);
    await result.current(formData());

    expect(action).toHaveBeenCalledTimes(2);
  });

  it("passes the form data through", async () => {
    const action = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useSingleFlight(action));
    const data = formData();

    await result.current(data);

    expect(action).toHaveBeenCalledWith(data);
  });
});
