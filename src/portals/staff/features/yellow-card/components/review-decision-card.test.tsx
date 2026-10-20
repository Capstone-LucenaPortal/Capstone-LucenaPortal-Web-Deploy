import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewDecisionCard } from "./review-decision-card";
import * as actions from "../lib/actions";
import type { YellowCardApplication, YellowCardStatus } from "../types";

function application(status: YellowCardStatus): YellowCardApplication {
  return {
    id: "app-1",
    reference_number: "YC-2026-000069",
    first_name: "Juan",
    middle_name: "Dizon",
    last_name: "Dela Cruz",
    suffix: null,
    barangay_name: "Ibabang Dupay",
    status,
    submitted_at: "2026-06-28T16:23:45.547482+00:00",
    due_at: "2026-06-30T16:23:45.547482+00:00",
    document_count: 1,
    deadline_state: "on_track",
    date_of_birth: "1990-05-14",
    gender_code: "male",
    civil_status_code: "married",
    complete_address: "123 Rizal St., Lucena City",
    contact_number: "09171234567",
    email_address: "juan@example.com",
    years_of_residency: 15,
    voter_id_number: "0000000029",
    privacy_consent: true,
    needs_dedup_review: false,
    decided_at: null,
    review_cycles: 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReviewDecisionCard", () => {
  it("shows all three actions for a pending application", () => {
    render(<ReviewDecisionCard application={application("pending")} actorName="Juan" />);

    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request revision/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
  });

  it("shows all three actions for a resubmitted application", () => {
    render(<ReviewDecisionCard application={application("resubmitted")} actorName="Juan" />);

    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
  });

  it.each<YellowCardStatus>(["revision_requested", "approved", "rejected", "withdrawn"])(
    "shows no decision buttons for a %s application, because the RPC would reject it",
    (status) => {
      render(<ReviewDecisionCard application={application(status)} actorName="Juan" />);

      expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^reject$/i })).not.toBeInTheDocument();
    },
  );

  it("requires a reason before the revision request can be confirmed", () => {
    render(<ReviewDecisionCard application={application("pending")} actorName="Juan" />);

    fireEvent.click(screen.getByRole("button", { name: /request revision/i }));
    expect(screen.getByRole("button", { name: /confirm request/i })).toBeDisabled();
  });

  it("calls the action with the approve decision and no reason", async () => {
    const review = vi.spyOn(actions, "reviewApplication").mockResolvedValue({ ok: true });
    render(<ReviewDecisionCard application={application("pending")} actorName="Juan" />);

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

    await waitFor(() =>
      expect(review).toHaveBeenCalledWith({
        applicationId: "app-1",
        decision: "approve",
        reason: undefined,
      }),
    );
  });

  it("calls the action with the reject decision and a trimmed reason", async () => {
    const review = vi.spyOn(actions, "reviewApplication").mockResolvedValue({ ok: true });
    render(<ReviewDecisionCard application={application("pending")} actorName="Juan" />);

    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    fireEvent.change(screen.getByPlaceholderText(/reason for rejection/i), {
      target: { value: "  Voter ID does not match.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm rejection/i }));

    await waitFor(() =>
      expect(review).toHaveBeenCalledWith({
        applicationId: "app-1",
        decision: "reject",
        reason: "Voter ID does not match.",
      }),
    );
  });

  it("quotes the reason and names the reviewer on a rejected application", () => {
    render(
      <ReviewDecisionCard
        application={{ ...application("rejected"), decided_at: "2026-06-30T08:00:00.000Z" }}
        actorName="Juan"
        latestReview={{
          id: "rev-1",
          decision: "reject",
          reason: "Voter ID does not match the name given.",
          reviewed_at: "2026-06-30T08:00:00.000Z",
          reviewed_by_name: "Maria Santos",
        }}
      />,
    );

    expect(
      screen.getByText("Voter ID does not match the name given."),
    ).toBeInTheDocument();
    expect(screen.getByText(/by Maria Santos on/)).toBeInTheDocument();
  });

  it("shows an approval without inventing a reason it does not have", () => {
    render(
      <ReviewDecisionCard
        application={application("approved")}
        actorName="Juan"
        latestReview={{
          id: "rev-2",
          decision: "approve",
          reason: null,
          reviewed_at: "2026-06-30T08:00:00.000Z",
          reviewed_by_name: "Maria Santos",
        }}
      />,
    );

    expect(screen.getByText(/Approved by Maria Santos on/)).toBeInTheDocument();
  });

  it("falls back to state-only copy when no review row explains the decision", () => {
    render(
      <ReviewDecisionCard
        application={{ ...application("rejected"), decided_at: "2026-06-30T08:00:00.000Z" }}
        actorName="Juan"
        latestReview={null}
      />,
    );

    expect(screen.getByText(/Rejected on/)).toBeInTheDocument();
  });

  it("surfaces a translated failure and never the raw database message", async () => {
    vi.spyOn(actions, "reviewApplication").mockResolvedValue({
      ok: false,
      message: "This application is no longer awaiting review.",
      stale: true,
    });
    render(<ReviewDecisionCard application={application("pending")} actorName="Juan" />);

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This application is no longer awaiting review.");
    expect(alert).not.toHaveTextContent("review_yellow_card_application");
  });
});
