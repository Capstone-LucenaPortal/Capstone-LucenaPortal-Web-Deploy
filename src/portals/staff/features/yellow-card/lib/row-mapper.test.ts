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
