import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MarkArrivalRead } from "@/portals/responder/features/incidents/components/mark-arrival-read";

const markArrivalRead = vi.fn();
vi.mock("@/portals/responder/features/incidents/actions", () => ({
  markArrivalRead: (id: string) => markArrivalRead(id),
}));

beforeEach(() => {
  markArrivalRead.mockReset().mockResolvedValue(undefined);
});

describe("MarkArrivalRead", () => {
  it("marks the opened incident's Inbox entry read, once per incident", () => {
    const { rerender } = render(<MarkArrivalRead incidentId="inc-1" />);
    rerender(<MarkArrivalRead incidentId="inc-1" />);
    expect(markArrivalRead).toHaveBeenCalledTimes(1);
    expect(markArrivalRead).toHaveBeenCalledWith("inc-1");

    rerender(<MarkArrivalRead incidentId="inc-2" />);
    expect(markArrivalRead).toHaveBeenLastCalledWith("inc-2");
  });

  it("swallows a failure: the entry just stays unread", async () => {
    markArrivalRead.mockRejectedValue(new Error("offline"));
    render(<MarkArrivalRead incidentId="inc-1" />);
    await Promise.resolve();
    expect(markArrivalRead).toHaveBeenCalled();
  });
});
