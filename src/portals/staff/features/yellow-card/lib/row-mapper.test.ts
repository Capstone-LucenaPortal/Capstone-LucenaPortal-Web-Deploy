import { describe, expect, it } from "vitest";
import {
  toApplication,
  toDocument,
  toQueueItem,
  toReview,
  type StaffYellowCardApplicationRow,
  type StaffYellowCardDocumentRow,
  type StaffYellowCardQueueRow,
  type StaffYellowCardReviewRow,
} from "./row-mapper";

function queueRow(
  overrides: Partial<StaffYellowCardQueueRow> = {},
): StaffYellowCardQueueRow {
  return {
    id: "4cf4d6d4-aba1-47a5-8895-573d7949e8ac",
    reference_number: "YC-2026-000069",
    first_name: "Demo9",
    middle_name: null,
    last_name: "Citizen9",
    suffix: null,
    barangay_name: "Barangay 1",
    status: "pending",
    submitted_at: "2026-06-28T16:23:45.547482+00:00",
    due_at: "2026-06-30T16:23:45.547482+00:00",
    document_count: 0,
    deadline_state: "at_risk",
    ...overrides,
  };
}

describe("toQueueItem", () => {
  it("passes through every column the list renders", () => {
    expect(toQueueItem(queueRow())).toEqual({
      id: "4cf4d6d4-aba1-47a5-8895-573d7949e8ac",
      reference_number: "YC-2026-000069",
      first_name: "Demo9",
      middle_name: null,
      last_name: "Citizen9",
      suffix: null,
      barangay_name: "Barangay 1",
      status: "pending",
      submitted_at: "2026-06-28T16:23:45.547482+00:00",
      due_at: "2026-06-30T16:23:45.547482+00:00",
      document_count: 0,
      deadline_state: "at_risk",
    });
  });

  it("keeps a null deadline_state, which means the clock is not running", () => {
    expect(toQueueItem(queueRow({ deadline_state: null })).deadline_state).toBeNull();
  });

  it("throws on a deadline_state the database does not produce", () => {
    expect(() => toQueueItem(queueRow({ deadline_state: "amber" }))).toThrow(/deadline_state/);
  });

  it("keeps a null due_at, which means the SLA clock is paused", () => {
    expect(toQueueItem(queueRow({ due_at: null })).due_at).toBeNull();
  });

  it("defaults a null document_count to zero rather than NaN", () => {
    expect(toQueueItem(queueRow({ document_count: null })).document_count).toBe(0);
  });

  it("throws when the view returns a row with no id", () => {
    expect(() => toQueueItem(queueRow({ id: null }))).toThrow(/id/i);
  });

  it("throws when the view returns a row with no status", () => {
    expect(() => toQueueItem(queueRow({ status: null }))).toThrow(/status/i);
  });
});

describe("toApplication", () => {
  const row: StaffYellowCardApplicationRow = {
    ...queueRow(),
    date_of_birth: "1990-05-14",
    gender_code: "male",
    civil_status_code: "married",
    complete_address: "123 Rizal St., Lucena City",
    contact_number: "09171234567",
    email_address: "demo9@example.com",
    years_of_residency: 15,
    voter_id_number: "0000000029",
    privacy_consent: true,
    needs_dedup_review: false,
    decided_at: null,
    review_cycles: 0,
    is_correction: false,
    replaces_card_id: null,
    replaced_card_number: null,
    replaced_card_status: null,
    correction_note: null,
    holds_printed_card: false,
    printed_card_number: null,
    card_id: null,
    card_number: null,
    card_status: null,
    card_holder_name: null,
    card_issued_on: null,
    card_revoked_reason: null,
    card_revoked_by_name: null,
    card_revoked_at: null,
    card_superseded_by_number: null,
    card_superseded_by_reference: null,
  };

  /** An approved application whose card is still Active. */
  const approved: StaffYellowCardApplicationRow = {
    ...row,
    status: "approved",
    decided_at: "2026-11-20T03:00:00+00:00",
    card_id: "c1d2e3f4-0000-4000-8000-000000000001",
    card_number: "LC-2026-000012",
    card_status: "active",
    card_holder_name: "Ana Reyes",
    card_issued_on: "2026-11-20",
  };

  it("returns null when the row is null, so the page can call notFound()", () => {
    expect(toApplication(null)).toBeNull();
  });

  it("maps every detail column", () => {
    const application = toApplication(row);
    expect(application?.gender_code).toBe("male");
    expect(application?.civil_status_code).toBe("married");
    expect(application?.voter_id_number).toBe("0000000029");
    expect(application?.years_of_residency).toBe(15);
    expect(application?.privacy_consent).toBe(true);
    expect(application?.review_cycles).toBe(0);
  });

  it("treats a null privacy_consent as not consented", () => {
    expect(toApplication({ ...row, privacy_consent: null })?.privacy_consent).toBe(false);
  });

  describe("Correction", () => {
    it("is null on a first application", () => {
      expect(toApplication(row)?.correction).toBeNull();
    });

    it("carries the replaced card and the Citizen's note", () => {
      const application = toApplication({
        ...row,
        is_correction: true,
        replaces_card_id: "c1d2e3f4-0000-4000-8000-000000000001",
        replaced_card_number: "LC-2026-000012",
        replaced_card_status: "revoked",
        correction_note: "My middle name is misspelled.",
      });
      expect(application?.correction).toEqual({
        replaced_card_id: "c1d2e3f4-0000-4000-8000-000000000001",
        replaced_card_number: "LC-2026-000012",
        replaced_card_status: "revoked",
        note: "My middle name is misspelled.",
      });
    });

    it("throws when the view returns a Correction with no replaced card", () => {
      expect(() =>
        toApplication({ ...row, is_correction: true, replaces_card_id: null }),
      ).toThrow(/replaces_card_id/);
    });
  });

  describe("existing holder", () => {
    it("says no printed card by default", () => {
      const application = toApplication(row);
      expect(application?.holds_printed_card).toBe(false);
      expect(application?.printed_card_number).toBeNull();
    });

    it("carries the printed card answer and its number", () => {
      const application = toApplication({
        ...row,
        holds_printed_card: true,
        printed_card_number: "0457",
      });
      expect(application?.holds_printed_card).toBe(true);
      expect(application?.printed_card_number).toBe("0457");
    });

    it("treats a null holds_printed_card as no printed card", () => {
      expect(
        toApplication({ ...row, holds_printed_card: null })?.holds_printed_card,
      ).toBe(false);
    });
  });

  describe("issued card", () => {
    it("is null when the application issued no card", () => {
      expect(toApplication(row)?.issued_card).toBeNull();
    });

    it("carries an Active card with no revocation and no successor", () => {
      expect(toApplication(approved)?.issued_card).toEqual({
        id: "c1d2e3f4-0000-4000-8000-000000000001",
        card_number: "LC-2026-000012",
        status: "active",
        holder_name: "Ana Reyes",
        issued_on: "2026-11-20",
        revocation: null,
        superseded_by: null,
      });
    });

    it("carries the reason, the revoker and the time of a Revocation", () => {
      const card = toApplication({
        ...approved,
        card_status: "revoked",
        card_revoked_reason: "Not a Lucena resident.",
        card_revoked_by_name: "Juan Dela Cruz",
        card_revoked_at: "2026-11-24T02:00:00+00:00",
      })?.issued_card;
      expect(card?.status).toBe("revoked");
      expect(card?.revocation).toEqual({
        reason: "Not a Lucena resident.",
        revoked_by_name: "Juan Dela Cruz",
        revoked_at: "2026-11-24T02:00:00+00:00",
      });
      expect(card?.superseded_by).toBeNull();
    });

    it("carries the card that superseded it and the Correction that issued that card", () => {
      const card = toApplication({
        ...approved,
        card_status: "superseded",
        card_superseded_by_number: "LC-2026-000031",
        card_superseded_by_reference: "YC-2026-000140",
      })?.issued_card;
      expect(card?.status).toBe("superseded");
      expect(card?.superseded_by).toEqual({
        card_number: "LC-2026-000031",
        correction_reference: "YC-2026-000140",
      });
      expect(card?.revocation).toBeNull();
    });

    it("throws when the view returns a card with no status", () => {
      expect(() => toApplication({ ...approved, card_status: null })).toThrow(
        /card_status/,
      );
    });
  });
});

describe("toDocument", () => {
  function documentRow(
    overrides: Partial<StaffYellowCardDocumentRow> = {},
  ): StaffYellowCardDocumentRow {
    return {
      id: "9f0d1c3e-1a2b-4c5d-8e9f-0a1b2c3d4e5f",
      application_id: "4cf4d6d4-aba1-47a5-8895-573d7949e8ac",
      document_type_code: "voter_id",
      document_type_label: "Valid Voter's ID",
      original_filename: "voter-id.jpg",
      mime_type: "image/jpeg",
      byte_size: 204_800,
      uploaded_at: "2026-06-28T16:23:45.547482+00:00",
      superseded_by: null,
      ...overrides,
    };
  }

  it("maps every column the viewer needs", () => {
    expect(toDocument(documentRow())).toEqual({
      id: "9f0d1c3e-1a2b-4c5d-8e9f-0a1b2c3d4e5f",
      document_type_code: "voter_id",
      document_type_label: "Valid Voter's ID",
      original_filename: "voter-id.jpg",
      mime_type: "image/jpeg",
      byte_size: 204_800,
      uploaded_at: "2026-06-28T16:23:45.547482+00:00",
    });
  });

  it("falls back to the code when the view has no label for the type", () => {
    expect(
      toDocument(documentRow({ document_type_label: null })).document_type_label,
    ).toBe("voter_id");
  });

  it("defaults a null byte_size to zero rather than NaN", () => {
    expect(toDocument(documentRow({ byte_size: null })).byte_size).toBe(0);
  });

  it("throws when the view returns a document with no id, which get_document_path needs", () => {
    expect(() => toDocument(documentRow({ id: null }))).toThrow(/id/i);
  });
});

describe("toReview", () => {
  function reviewRow(
    overrides: Partial<StaffYellowCardReviewRow> = {},
  ): StaffYellowCardReviewRow {
    return {
      id: "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a8b",
      application_id: "4cf4d6d4-aba1-47a5-8895-573d7949e8ac",
      decision: "revise",
      reason: "The voter ID photo is unreadable.",
      reviewed_at: "2026-06-29T08:00:00.000Z",
      reviewed_by_name: "Maria Santos",
      ...overrides,
    };
  }

  it("returns null when there is no review yet", () => {
    expect(toReview(null)).toBeNull();
  });

  it("maps the decision, reason and reviewer", () => {
    expect(toReview(reviewRow())).toEqual({
      id: "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a8b",
      decision: "revise",
      reason: "The voter ID photo is unreadable.",
      reviewed_at: "2026-06-29T08:00:00.000Z",
      reviewed_by_name: "Maria Santos",
    });
  });

  it("keeps a null reason, which is what an approval carries", () => {
    expect(toReview(reviewRow({ decision: "approve", reason: null }))?.reason).toBeNull();
  });

  it("falls back rather than blanking when the reviewer name is not exposed", () => {
    expect(toReview(reviewRow({ reviewed_by_name: null }))?.reviewed_by_name).toBe(
      "a staff member",
    );
  });

  it("throws when the row carries no decision, which the copy branches on", () => {
    expect(() => toReview(reviewRow({ decision: null }))).toThrow(/decision/i);
  });
});
