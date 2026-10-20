import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import YellowCardDetailPage from "./page";
import * as dossiers from "@/portals/staff/features/yellow-card/lib/review-dossier";
import * as session from "@/portals/staff/features/auth/lib/session";
import type { YellowCardReviewDossier } from "@/portals/staff/features/yellow-card/lib/review-dossier";
import type { StaffUser } from "@/portals/staff/features/auth/types";

const user: StaffUser = {
  id: "staff-001",
  email: "juan.delacruz@lucenacity.gov.ph",
  full_name: "Juan Dela Cruz",
  role: "staff",
  department: "Yellow Card Office",
  assignedModules: ["yellow-card"],
  created_at: "2026-01-15T08:00:00.000Z",
};

/**
 * One object, because the route now makes one read. The labels arrive already
 * resolved — resolving them is the dossier's job and is tested there.
 */
const dossier: YellowCardReviewDossier = {
  application: {
    id: "app-1",
    reference_number: "YC-2026-000069",
    first_name: "Juan",
    middle_name: "Dizon",
    last_name: "Dela Cruz",
    suffix: null,
    barangay_name: "Ibabang Dupay",
    status: "pending",
    submitted_at: "2026-06-28T16:23:45.547482+00:00",
    due_at: "2026-06-30T16:23:45.547482+00:00",
    document_count: 1,
    deadline_state: "on_track",
    date_of_birth: "1990-05-14",
    gender_code: "male",
    civil_status_code: "married",
    complete_address: "123 Rizal St., Ibabang Dupay, Lucena City",
    contact_number: "09171234567",
    email_address: "juan.delacruz@example.com",
    years_of_residency: 15,
    voter_id_number: "0000000029",
    privacy_consent: true,
    needs_dedup_review: false,
    decided_at: null,
    review_cycles: 0,
  },
  documents: [
    {
      id: "doc-1",
      document_type_code: "voter_id",
      document_type_label: "Valid Voter's ID",
      original_filename: "voter-id.jpg",
      mime_type: "image/jpeg",
      byte_size: 204_800,
      uploaded_at: "2026-06-28T16:23:45.547482+00:00",
    },
  ],
  latestReview: null,
  genderLabel: "Male",
  civilStatusLabel: "Married",
};

/**
 * The route's two reads. `overrides` replaces whole fields of the one fixture,
 * so a test changing part of the application passes the whole application.
 */
function stubReads(overrides: Partial<YellowCardReviewDossier> = {}) {
  vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue(user);
  return vi
    .spyOn(dossiers, "getReviewDossier")
    .mockResolvedValue({ ...dossier, ...overrides });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("YellowCardDetailPage", () => {
  it("renders every submitted field, showing the labels the dossier resolved", async () => {
    stubReads();

    render(await YellowCardDetailPage({ params: Promise.resolve({ id: "app-1" }) }));

    expect(screen.getByRole("link", { name: /back to yellow card/i })).toHaveAttribute(
      "href",
      "/staff/yellow-card",
    );
    expect(screen.getByText("Juan Dizon Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText(/YC-2026-000069/)).toBeInTheDocument();
    expect(screen.getByText("Male")).toBeInTheDocument();
    expect(screen.getByText("Married")).toBeInTheDocument();
    expect(screen.queryByText("male")).not.toBeInTheDocument();
    expect(screen.getByText("Ibabang Dupay")).toBeInTheDocument();
    expect(screen.getByText("0000000029")).toBeInTheDocument();
    expect(screen.getByText("15 years")).toBeInTheDocument();
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });

  it("shows the decision controls for a reviewable application", async () => {
    stubReads();

    render(await YellowCardDetailPage({ params: Promise.resolve({ id: "app-1" }) }));

    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request revision/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
  });

  /** The dossier hands over a raw byte count; the typography is the route's. */
  it("lists each confirmed upload with a link to the gated proxy route", async () => {
    stubReads();

    render(await YellowCardDetailPage({ params: Promise.resolve({ id: "app-1" }) }));

    expect(screen.getByText("Valid Voter's ID")).toBeInTheDocument();
    expect(screen.getByText(/voter-id\.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/200 KB/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view file/i })).toHaveAttribute(
      "href",
      "/staff/api/yellow-card/documents/doc-1",
    );
  });

  it("asks for the dossier of the application in the URL", async () => {
    const getReviewDossier = stubReads();

    render(await YellowCardDetailPage({ params: Promise.resolve({ id: "app-1" }) }));

    expect(getReviewDossier).toHaveBeenCalledWith("app-1");
  });

  it("shows an honest empty state rather than a viewer when nothing is attached", async () => {
    stubReads({ documents: [] });

    render(await YellowCardDetailPage({ params: Promise.resolve({ id: "app-1" }) }));

    expect(screen.getByText("No documents attached.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view file/i })).not.toBeInTheDocument();
  });

  it("quotes the previous reviewer's reason on a revision-requested application", async () => {
    stubReads({
      application: { ...dossier.application, status: "revision_requested" },
      latestReview: {
        id: "rev-1",
        decision: "revise",
        reason: "The voter ID photo is unreadable.",
        reviewed_at: "2026-06-29T08:00:00.000Z",
        reviewed_by_name: "Maria Santos",
      },
    });

    render(await YellowCardDetailPage({ params: Promise.resolve({ id: "app-1" }) }));

    expect(screen.getByText("The voter ID photo is unreadable.")).toBeInTheDocument();
    expect(screen.getByText(/Maria Santos/)).toBeInTheDocument();
  });

  it("still renders a decided application when no review row exists to explain it", async () => {
    stubReads({
      application: {
        ...dossier.application,
        status: "rejected",
        decided_at: "2026-06-30T08:00:00.000Z",
      },
      latestReview: null,
    });

    render(await YellowCardDetailPage({ params: Promise.resolve({ id: "app-1" }) }));

    // The seeded sandbox rows have no yellow_card_reviews behind them.
    expect(screen.getByText(/Rejected on/)).toBeInTheDocument();
  });

  it("calls notFound when the id does not resolve", async () => {
    vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue(user);
    vi.spyOn(dossiers, "getReviewDossier").mockResolvedValue(null);

    await expect(
      YellowCardDetailPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow();
  });

  /**
   * The guard comes before the session read, not beside it. Reading both at
   * once would fire a read for a page nobody is going to see, and would put a
   * function that throws by design in front of notFound().
   */
  it("does not read who is looking when there is nothing to look at", async () => {
    const getCurrentStaffUser = vi
      .spyOn(session, "getCurrentStaffUser")
      .mockResolvedValue(user);
    vi.spyOn(dossiers, "getReviewDossier").mockResolvedValue(null);

    await expect(
      YellowCardDetailPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow();

    expect(getCurrentStaffUser).not.toHaveBeenCalled();
  });
});
