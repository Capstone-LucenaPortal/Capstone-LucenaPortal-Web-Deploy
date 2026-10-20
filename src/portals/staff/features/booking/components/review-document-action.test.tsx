import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewDocumentAction } from "./review-document-action";
import * as actions from "../lib/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

/** A Tier Claim on its first look, with its document on file. */
const FIRST_LOOK = { hasOrgDocument: true, decline: "revise" } as const;
/** The second and last look, after a Resubmission. */
const SECOND_LOOK = { hasOrgDocument: true, decline: "reject" } as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReviewDocumentAction", () => {
  it("disables rather than hides the controls when there is no document", () => {
    // Decision 4. Hiding them would make an unsubstantiated claim look like
    // nothing needed doing.
    render(
      <ReviewDocumentAction bookingId="bk-1" hasOrgDocument={false} decline="revise" />,
    );

    expect(screen.getByRole("button", { name: "Accept Tier Claim" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request revision" })).toBeDisabled();
    expect(
      screen.getByText(/No organisation document has been uploaded/i),
    ).toBeInTheDocument();
  });

  it("accepts without a reason", async () => {
    const spy = vi.spyOn(actions, "reviewDocument").mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReviewDocumentAction bookingId="bk-1" {...FIRST_LOOK} />);

    await user.click(screen.getByRole("button", { name: "Accept Tier Claim" }));

    expect(spy).toHaveBeenCalledWith({
      bookingId: "bk-1",
      decision: "accept",
      reason: undefined,
    });
  });

  describe("on the first look", () => {
    it("offers a Revision Request and no reject", () => {
      // SCRUM-198: a blurry scan must not be punished with full price.
      render(<ReviewDocumentAction bookingId="bk-1" {...FIRST_LOOK} />);

      expect(screen.getByRole("button", { name: "Request revision" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    });

    it("says what a Revision Request does before it is sent", async () => {
      const user = userEvent.setup();
      render(<ReviewDocumentAction bookingId="bk-1" {...FIRST_LOOK} />);

      await user.click(screen.getByRole("button", { name: "Request revision" }));

      expect(screen.getByText(/organiser will read this reason/i)).toBeInTheDocument();
      expect(screen.getByText(/cancelled and the slot released/i)).toBeInTheDocument();
      expect(screen.getByText(/only Revision Request/i)).toBeInTheDocument();
    });

    it("requires the reason the organiser will read, and sends it as a revise", async () => {
      const spy = vi.spyOn(actions, "reviewDocument").mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<ReviewDocumentAction bookingId="bk-1" {...FIRST_LOOK} />);

      await user.click(screen.getByRole("button", { name: "Request revision" }));
      const send = screen.getByRole("button", { name: "Send Revision Request" });
      expect(send).toBeDisabled();

      await user.type(screen.getByLabelText(/Reason/), "The scan is unreadable");
      expect(send).toBeEnabled();
      await user.click(send);

      expect(spy).toHaveBeenCalledWith({
        bookingId: "bk-1",
        decision: "revise",
        reason: "The scan is unreadable",
      });
    });
  });

  describe("on the second look", () => {
    it("offers the reject and no second Revision Request", () => {
      render(<ReviewDocumentAction bookingId="bk-1" {...SECOND_LOOK} />);

      expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Request revision" })).toBeNull();
    });

    it("says rejecting reprices to commercial and leaves the organiser to pay or cancel", async () => {
      // Not obvious, and it moves money.
      const user = userEvent.setup();
      render(<ReviewDocumentAction bookingId="bk-1" {...SECOND_LOOK} />);

      await user.click(screen.getByRole("button", { name: "Reject" }));

      expect(screen.getByText(/repriced at the commercial rate/i)).toBeInTheDocument();
      expect(screen.getByText(/pay it or cancel the booking/i)).toBeInTheDocument();
      // No money can be on file yet, so nothing is said about setting any aside.
      expect(screen.queryByText(/already sent/i)).toBeNull();
    });

    it("requires a reason to reject, and sends it", async () => {
      const spy = vi.spyOn(actions, "reviewDocument").mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<ReviewDocumentAction bookingId="bk-1" {...SECOND_LOOK} />);

      await user.click(screen.getByRole("button", { name: "Reject" }));
      const confirm = screen.getByRole("button", { name: "Reject and reprice" });
      expect(confirm).toBeDisabled();

      await user.type(screen.getByLabelText(/Reason/), "Not a registered NGO");
      await user.click(confirm);

      expect(spy).toHaveBeenCalledWith({
        bookingId: "bk-1",
        decision: "reject",
        reason: "Not a registered NGO",
      });
    });
  });

  it("surfaces the action's refusal", async () => {
    vi.spyOn(actions, "reviewDocument").mockResolvedValue({
      ok: false,
      message: "There is no organisation document on file for this booking to review.",
      stale: true,
    });
    const user = userEvent.setup();
    render(<ReviewDocumentAction bookingId="bk-1" {...FIRST_LOOK} />);

    await user.click(screen.getByRole("button", { name: "Accept Tier Claim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "There is no organisation document on file",
    );
  });
});
