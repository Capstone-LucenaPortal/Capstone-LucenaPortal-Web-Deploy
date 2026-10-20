import { fetchAllRows } from "@/portals/admin/lib/supabase/pagination";
import { vi } from "vitest";

function makeRows(count: number, startId: number): { id: number }[] {
  return Array.from({ length: count }, (_, i) => ({ id: startId + i }));
}

describe("fetchAllRows", () => {
  it("concatenates a 1000 + 1000 + 240 row view across three sequential .range() calls", async () => {
    const page1 = makeRows(1000, 0);
    const page2 = makeRows(1000, 1000);
    const page3 = makeRows(240, 2000);

    const mockRange = vi.fn();
    mockRange
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })
      .mockResolvedValueOnce({ data: page3, error: null });

    const result = await fetchAllRows({ range: mockRange });

    expect(mockRange).toHaveBeenCalledTimes(3);
    expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(mockRange).toHaveBeenNthCalledWith(3, 2000, 2999);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2240);
    expect(result.data).toEqual([...page1, ...page2, ...page3]);
  });

  it("fetches one extra, empty page to confirm the end when the total is an exact multiple of the page size", async () => {
    const page1 = makeRows(1000, 0);
    const page2 = makeRows(1000, 1000);

    const mockRange = vi.fn();
    mockRange
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await fetchAllRows({ range: mockRange });

    // A full-length second page (exactly PAGE_SIZE rows) is not itself proof
    // there's no next page — the loop must issue a third request and see it
    // come back short before it can conclude the data ended at exactly 2000
    // rows rather than continuing beyond it.
    expect(mockRange).toHaveBeenCalledTimes(3);
    expect(mockRange).toHaveBeenNthCalledWith(3, 2000, 2999);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2000);
    expect(result.data).toEqual([...page1, ...page2]);
  });

  it("returns a single page unchanged when the view has fewer than PAGE_SIZE rows", async () => {
    const rows = makeRows(3, 0);
    const mockRange = vi.fn().mockResolvedValue({ data: rows, error: null });

    const result = await fetchAllRows({ range: mockRange });

    expect(mockRange).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(rows);
  });

  it("stops and discards prior pages when a later page errors", async () => {
    const page1 = makeRows(1000, 0);
    const error = { code: "42501", message: "not an active Admin" };

    const mockRange = vi.fn();
    mockRange
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: null, error });

    const result = await fetchAllRows({ range: mockRange });

    expect(mockRange).toHaveBeenCalledTimes(2);
    expect(result.data).toBeNull();
    expect(result.error).toEqual(error);
  });

  it("returns [] with no error when the view is empty", async () => {
    const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });

    const result = await fetchAllRows({ range: mockRange });

    expect(mockRange).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  // Admin Portal Fix Plan, Task 4.2: fetchAllRows must check `signal.aborted`
  // at the TOP of every loop iteration, including the very first — an
  // already-aborted signal must stop the fetch before even the first page's
  // request is issued.
  it("issues no request at all when the given signal is already aborted", async () => {
    const mockRange = vi.fn();
    const controller = new AbortController();
    controller.abort();

    const result = await fetchAllRows({ range: mockRange }, controller.signal);

    expect(mockRange).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  // This is what actually stops a cancelled fetch MID-pagination rather than
  // only ever affecting the first page: the signal is aborted only after
  // page 1 has already resolved, simulating a caller cancelling while a
  // large view is still being paged through. The loop must notice the abort
  // before issuing page 2's request, not fire it off and rely on the
  // request itself rejecting.
  it("stops issuing further page requests once the signal is aborted between pages", async () => {
    const page1 = makeRows(1000, 0);
    const controller = new AbortController();

    const mockRange = vi.fn().mockImplementation(() => {
      // Abort as a side effect of the FIRST page resolving — by the time the
      // loop is ready to fetch page 2, the signal is already aborted.
      if (mockRange.mock.calls.length === 1) {
        controller.abort();
      }
      return Promise.resolve({ data: page1, error: null });
    });

    const result = await fetchAllRows({ range: mockRange }, controller.signal);

    // Page 1 (a full PAGE_SIZE page) on its own gives no signal that pagination
    // is done — without the mid-loop abort check, the loop would issue a
    // second request for page 2 regardless.
    expect(mockRange).toHaveBeenCalledTimes(1);
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("completes normally when a signal is given but never aborted", async () => {
    const rows = makeRows(3, 0);
    const mockRange = vi.fn().mockResolvedValue({ data: rows, error: null });
    const controller = new AbortController();

    const result = await fetchAllRows({ range: mockRange }, controller.signal);

    expect(result.data).toEqual(rows);
    expect(result.error).toBeNull();
  });
});
