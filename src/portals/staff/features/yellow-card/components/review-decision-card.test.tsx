import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ReviewDecisionCard } from "./review-decision-card";
import * as actions from "../lib/actions";
import type {
  YellowCardApplication,
  YellowCardIssuedCard,
  YellowCardStatus,
} from "../types";

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
    is_correction: false,
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
    correction: null,
    holds_printed_card: false,
    printed_card_number: null,
    issued_card: null,
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

  describe("the duplicate-review banner", () => {
    const BANNER = /Flagged for duplicate review — this voter ID matches an existing record\. Check before approving\./;

    function flagged(status: YellowCardStatus): YellowCardApplication {
      return { ...application(status), needs_dedup_review: true };
    }

    it("shows on a flagged pending application", () => {
      render(<ReviewDecisionCard application={flagged("pending")} actorName="Juan" />);

      expect(screen.getByText(BANNER)).toBeInTheDocument();
    });

    it("still shows after a flagged application is resubmitted, ahead of the Resubmitted notice", () => {
      render(
        <ReviewDecisionCard
          application={{ ...flagged("resubmitted"), review_cycles: 1 }}
          actorName="Juan"
          latestReview={{
            id: "rev-3",
            decision: "revise",
            reason: "Upload a clearer copy of the voter ID.",
            reviewed_at: "2026-06-30T08:00:00.000Z",
            reviewed_by_name: "Maria Santos",
          }}
        />,
      );

      const banner = screen.getByText(BANNER);
      const resubmitted = screen.getByText(/Resubmitted after a revision request — review cycle 2\./);
      expect(banner.compareDocumentPosition(resubmitted)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(screen.getByText("Upload a clearer copy of the voter ID.")).toBeInTheDocument();
    });

    it.each<[YellowCardStatus, RegExp]>([
      ["revision_requested", /Waiting on the applicant to resubmit/],
      ["approved", /^Approved/],
      ["rejected", /^Rejected/],
      ["withdrawn", /Withdrawn by the applicant/],
    ])(
      "does not show on a flagged %s application, which keeps its own notice",
      (status, notice) => {
        render(<ReviewDecisionCard application={flagged(status)} actorName="Juan" />);

        expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
        expect(screen.getByText(notice)).toBeInTheDocument();
      },
    );

    it("does not show on an unflagged resubmitted application", () => {
      render(<ReviewDecisionCard application={application("resubmitted")} actorName="Juan" />);

      expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
      expect(screen.getByText(/Resubmitted after a revision request/)).toBeInTheDocument();
    });
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

  // -------------------------------------------------------------------------
  // The issued card and its Revocation (ADR 0011)
  // -------------------------------------------------------------------------

  describe("the Yellow Card section", () => {
    const CARD: YellowCardIssuedCard = {
      id: "card-45",
      card_number: "LC-2026-000045",
      status: "active",
      holder_name: "Juan Dela Cruz",
      issued_on: "2026-11-12",
      revocation: null,
      superseded_by: null,
    };

    function approvedWith(card: Partial<YellowCardIssuedCard>): YellowCardApplication {
      return {
        ...application("approved"),
        decided_at: "2026-11-12T03:00:00.000Z",
        issued_card: { ...CARD, ...card },
      };
    }

    const section = () => screen.getByRole("region", { name: "Yellow Card" });

    it("shows an Active card with its number, printed name and issue date, and the Revoke button", () => {
      render(<ReviewDecisionCard application={approvedWith({})} actorName="Rosa Cruz" />);

      expect(section()).toHaveTextContent("LC-2026-000045");
      expect(section()).toHaveTextContent("Active");
      expect(section()).toHaveTextContent("Printed as DELA CRUZ, JUAN DIZON");
      expect(section()).toHaveTextContent("issued November 12, 2026");
      expect(screen.getByRole("button", { name: "Revoke card" })).toBeInTheDocument();
    });

    /** A card is attached so only the status can be what hides the section. */
    it.each<YellowCardStatus>(["pending", "resubmitted", "revision_requested", "rejected", "withdrawn"])(
      "is absent from a %s application",
      (status) => {
        render(
          <ReviewDecisionCard
            application={{ ...application(status), issued_card: CARD }}
            actorName="Rosa Cruz"
          />,
        );

        expect(screen.queryByRole("region", { name: "Yellow Card" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Revoke card" })).not.toBeInTheDocument();
      },
    );

    /** Seeded Sandbox rows were approved without going through the RPC. */
    it("is absent from an approved application that issued no card", () => {
      render(<ReviewDecisionCard application={application("approved")} actorName="Rosa Cruz" />);

      expect(screen.queryByRole("region", { name: "Yellow Card" })).not.toBeInTheDocument();
    });

    describe("the Revoke dialog", () => {
      function openDialog() {
        render(<ReviewDecisionCard application={approvedWith({})} actorName="Rosa Cruz" />);
        fireEvent.click(screen.getByRole("button", { name: "Revoke card" }));
      }

      const reasonBox = () => screen.getByLabelText(/reason \(required, shown to the citizen\)/i);
      const confirmButton = () => screen.getByRole("button", { name: "Confirm revocation" });

      it("names the card and says what revoking does and under whose name", () => {
        openDialog();

        expect(
          screen.getByRole("heading", { name: "Revoke Yellow Card LC-2026-000045" }),
        ).toBeInTheDocument();
        expect(screen.getByText(/a Verifier who scans it is told not to accept it/)).toBeInTheDocument();
        expect(screen.getByText(/This cannot be undone\./)).toBeInTheDocument();
        expect(
          screen.getByText(/Juan Dizon Dela Cruz is told the reason and may apply again/),
        ).toBeInTheDocument();
        expect(screen.getByText(/Recorded under Rosa Cruz\./)).toBeInTheDocument();
      });

      it("cannot be confirmed without a reason", () => {
        openDialog();

        expect(confirmButton()).toBeDisabled();
        fireEvent.change(reasonBox(), { target: { value: "   " } });
        expect(confirmButton()).toBeDisabled();
      });

      /** The procedure refuses a reason of nothing but full stops (DB l85). */
      it("cannot be confirmed with a reason of only full stops", () => {
        openDialog();

        fireEvent.change(reasonBox(), { target: { value: " ... " } });
        expect(confirmButton()).toBeDisabled();
      });

      it("revokes the card with the trimmed reason and closes", async () => {
        const revoke = vi.spyOn(actions, "revokeCard").mockResolvedValue({ ok: true });
        openDialog();

        fireEvent.change(reasonBox(), {
          target: { value: "  Approved without checking residency.  " },
        });
        fireEvent.click(confirmButton());

        await waitFor(() =>
          expect(revoke).toHaveBeenCalledWith({
            applicationId: "app-1",
            cardId: "card-45",
            reason: "Approved without checking residency.",
          }),
        );
        await waitFor(() =>
          expect(
            screen.queryByRole("heading", { name: /Revoke Yellow Card/ }),
          ).not.toBeInTheDocument(),
        );
      });

      it("shows the translated failure as an error toast", async () => {
        vi.spyOn(actions, "revokeCard").mockResolvedValue({
          ok: false,
          message: "This card is no longer active.",
          stale: true,
        });
        openDialog();

        fireEvent.change(reasonBox(), {
          target: { value: "Approved without checking residency." },
        });
        fireEvent.click(confirmButton());

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "This card is no longer active.",
        );
      });
    });

    const REVOKED = approvedWith({
      status: "revoked",
      revocation: {
        reason: "Approved without checking residency.",
        revoked_by_name: "Rosa Cruz",
        revoked_at: "2026-11-24T02:00:00.000Z",
      },
    });

    it("shows a Revoked card with the revoker, the date and the reason, and no button", () => {
      render(<ReviewDecisionCard application={REVOKED} actorName="Rosa Cruz" />);

      expect(section()).toHaveTextContent("Revoked by Rosa Cruz on November 24, 2026.");
      expect(screen.getByText("Approved without checking residency.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Revoke card" })).not.toBeInTheDocument();
    });

    /** The application's own decision stands; only the card changed. */
    it("leaves the application's Approved notice in place beside a Revoked card", () => {
      render(<ReviewDecisionCard application={REVOKED} actorName="Rosa Cruz" />);

      expect(screen.getByText(/^Approved on/)).toBeInTheDocument();
    });

    describe("a Superseded card", () => {
      const SUPERSEDED = approvedWith({
        status: "superseded",
        superseded_by: {
          card_number: "LC-2026-000312",
          correction_reference: "YC-2026-000210",
        },
      });

      it("says which card replaced it, when, and links to the Correction, with no button", () => {
        render(
          <ReviewDecisionCard
            application={SUPERSEDED}
            actorName="Rosa Cruz"
            supersedingCorrection={{
              id: "correction-1",
              decided_at: "2026-11-20T06:30:00.000Z",
            }}
          />,
        );

        expect(section()).toHaveTextContent("Superseded");
        expect(section()).toHaveTextContent(
          "Replaced by LC-2026-000312 on November 20, 2026, when Correction YC-2026-000210 was approved.",
        );
        expect(screen.getByRole("link", { name: "YC-2026-000210" })).toHaveAttribute(
          "href",
          "/staff/yellow-card/correction-1",
        );
        expect(screen.queryByRole("button", { name: "Revoke card" })).not.toBeInTheDocument();
      });

      /** The Correction's row could not be read back: name it, unlinked and undated. */
      it("still names the replacement when the Correction could not be read", () => {
        render(
          <ReviewDecisionCard
            application={SUPERSEDED}
            actorName="Rosa Cruz"
            supersedingCorrection={null}
          />,
        );

        expect(section()).toHaveTextContent(
          "Replaced by LC-2026-000312 when Correction YC-2026-000210 was approved.",
        );
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// A Correction and an existing holder (ADR 0011, #170)
// ---------------------------------------------------------------------------

describe("ReviewDecisionCard — a Correction", () => {
  const CORRECTION: YellowCardApplication = {
    ...application("pending"),
    reference_number: "YC-2026-000210",
    is_correction: true,
    correction: {
      replaced_card_id: "card-45",
      replaced_card_number: "LC-2026-000045",
      replaced_card_status: "active",
      note: "My middle name is misspelled as Dison.",
    },
  };

  const notice = () => screen.getByRole("region", { name: "Correction" });

  it("says which card it replaces, linked to the application that issued it, and quotes the note", () => {
    render(
      <ReviewDecisionCard
        application={CORRECTION}
        actorName="Rosa Cruz"
        replacedCardApplicationId="issuer-1"
      />,
    );

    expect(notice()).toHaveTextContent("Replaces LC-2026-000045");
    expect(notice()).not.toHaveTextContent("(active)");
    expect(screen.getByRole("link", { name: "LC-2026-000045" })).toHaveAttribute(
      "href",
      "/staff/yellow-card/issuer-1",
    );
    expect(notice()).toHaveTextContent("What needs correcting?");
    expect(within(notice()).getByText("My middle name is misspelled as Dison.").tagName).toBe(
      "BLOCKQUOTE",
    );
  });

  it.each(["revoked", "superseded"] as const)(
    "names the replaced card's status when it is %s",
    (status) => {
      render(
        <ReviewDecisionCard
          application={{
            ...CORRECTION,
            correction: { ...CORRECTION.correction!, replaced_card_status: status },
          }}
          actorName="Rosa Cruz"
          replacedCardApplicationId="issuer-1"
        />,
      );

      expect(notice()).toHaveTextContent(`Replaces LC-2026-000045 (${status})`);
    },
  );

  /** The issuing application could not be read back: name the card, unlinked. */
  it("still names the replaced card when its application could not be read", () => {
    render(<ReviewDecisionCard application={CORRECTION} actorName="Rosa Cruz" />);

    expect(notice()).toHaveTextContent("Replaces LC-2026-000045");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("is absent from a first application", () => {
    render(<ReviewDecisionCard application={application("pending")} actorName="Rosa Cruz" />);

    expect(screen.queryByRole("region", { name: "Correction" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Replaces/)).not.toBeInTheDocument();
  });

  it("is decided with the same three actions as any application", () => {
    render(<ReviewDecisionCard application={CORRECTION} actorName="Rosa Cruz" />);

    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request revision/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
  });

  it("warns in the approve dialog that the old card is superseded and a new number issued", () => {
    render(<ReviewDecisionCard application={CORRECTION} actorName="Rosa Cruz" />);

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    const dialog = screen.getByRole("heading", { name: "Approve Correction" }).parentElement!;
    expect(dialog).toHaveTextContent(
      "Yellow Card LC-2026-000045 becomes Superseded and a new card is issued with a new card number.",
    );
    expect(dialog).toHaveTextContent("recorded under Rosa Cruz");
  });

  /** ADR 0011: a revoked card never becomes superseded; approving leaves it revoked. */
  it("says a revoked replaced card stays revoked, not that it is superseded", () => {
    render(
      <ReviewDecisionCard
        application={{
          ...CORRECTION,
          correction: { ...CORRECTION.correction!, replaced_card_status: "revoked" },
        }}
        actorName="Rosa Cruz"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    const dialog = screen.getByRole("heading", { name: "Approve Correction" }).parentElement!;
    expect(dialog).toHaveTextContent(
      "Yellow Card LC-2026-000045 stays revoked and a new card is issued with a new card number.",
    );
    expect(dialog).not.toHaveTextContent("Superseded");
  });

  it("keeps the first application's approve copy for a first application", () => {
    render(<ReviewDecisionCard application={application("pending")} actorName="Rosa Cruz" />);

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    expect(screen.getByRole("heading", { name: "Approve application" })).toBeInTheDocument();
    expect(screen.queryByText(/Superseded/)).not.toBeInTheDocument();
  });
});

describe("ReviewDecisionCard — an existing holder", () => {
  it("prompts a paper registry check with the printed card number given", () => {
    render(
      <ReviewDecisionCard
        application={{
          ...application("pending"),
          holds_printed_card: true,
          printed_card_number: "0012345",
        }}
        actorName="Rosa Cruz"
      />,
    );

    expect(
      screen.getByText("Existing holder: printed card no. 0012345; check the paper registry."),
    ).toBeInTheDocument();
  });

  it("says the number was not given when the applicant left it blank", () => {
    render(
      <ReviewDecisionCard
        application={{ ...application("pending"), holds_printed_card: true }}
        actorName="Rosa Cruz"
      />,
    );

    expect(
      screen.getByText("Existing holder: printed card no. not given; check the paper registry."),
    ).toBeInTheDocument();
  });

  it("does not show when the applicant holds no printed card", () => {
    render(<ReviewDecisionCard application={application("pending")} actorName="Rosa Cruz" />);

    expect(screen.queryByText(/Existing holder/)).not.toBeInTheDocument();
  });
});
