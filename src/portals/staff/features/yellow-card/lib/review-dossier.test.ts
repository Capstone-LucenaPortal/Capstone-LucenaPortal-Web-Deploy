import { afterEach, describe, expect, it, vi } from "vitest";
import {
  columnsOf,
  createTableFetch,
  createTestClient,
  parseQueryParams,
  requestTo,
  type ParsedQueryParams,
} from "@/portals/staff/lib/supabase/testing";
import * as catalogs from "@/portals/staff/lib/supabase/catalogs";
import { getReviewDossier } from "./review-dossier";
import type {
  StaffYellowCardApplicationRow,
  StaffYellowCardDocumentRow,
  StaffYellowCardQueueRow,
  StaffYellowCardReviewRow,
} from "./row-mapper";

const APP_ID = "4cf4d6d4-aba1-47a5-8895-573d7949e8ac";

/**
 * The queue row these fixtures build on is defined identically in
 * queries.test.ts, which still owns the queue and status-count reads. The two
 * files agree on who Maria is on purpose: a reader comparing a detail
 * assertion here against a queue assertion there is comparing the same person.
 */
const CANNED_QUEUE_ROW: StaffYellowCardQueueRow = {
  id: "app-1",
  reference_number: "YC-2026-000123",
  first_name: "Maria",
  middle_name: "Santos",
  last_name: "Dela Cruz",
  suffix: null,
  barangay_name: "Barangay Ibabang Dupay",
  status: "pending",
  submitted_at: "2026-08-01T02:11:09.114000+00:00",
  due_at: "2026-08-04T02:11:09.114000+00:00",
  document_count: 3,
  deadline_state: "overdue",
  is_correction: false,
};

const CANNED_APPLICATION_ROW: StaffYellowCardApplicationRow = {
  ...CANNED_QUEUE_ROW,
  id: APP_ID,
  date_of_birth: "1991-03-14",
  gender_code: "female",
  civil_status_code: "married",
  complete_address: "12 Quezon Ave, Ibabang Dupay, Lucena City",
  contact_number: "09171234567",
  email_address: "maria.delacruz@example.com",
  years_of_residency: 15,
  voter_id_number: "0000000029",
  privacy_consent: true,
  needs_dedup_review: false,
  decided_at: null,
  review_cycles: 0,
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

const CANNED_DOCUMENT_ROW: StaffYellowCardDocumentRow = {
  id: "doc-1",
  application_id: "app-1",
  document_type_code: "voter_id",
  document_type_label: "Valid Voter's ID",
  original_filename: "voter-id.jpg",
  mime_type: "image/jpeg",
  byte_size: 204_800,
  uploaded_at: "2026-06-28T16:23:45.547482+00:00",
  superseded_by: null,
};

const CANNED_REVIEW_ROW: StaffYellowCardReviewRow = {
  id: "review-2",
  application_id: APP_ID,
  decision: "revise",
  reason: "The voter ID photo is too blurred to read.",
  reviewed_at: "2026-08-03T07:45:12.000000+00:00",
  reviewed_by_name: "Ana Reyes",
};

const APPLICATIONS = "staff_yellow_card_queue";
const DOCUMENTS = "staff_yellow_card_documents";
const REVIEWS = "staff_yellow_card_reviews";

/**
 * All three tables answered, so one call drives every read the dossier makes.
 * The reads whose query shape is asserted below do not care what comes back,
 * only that they fired.
 *
 * This stays local while `createTableFetch` does not: it names this module's
 * three tables and this file's canned rows, so there is nothing in it two
 * dossiers could share.
 */
function createFullDossierFetch() {
  return createTableFetch({
    [APPLICATIONS]: [CANNED_APPLICATION_ROW],
    [DOCUMENTS]: [CANNED_DOCUMENT_ROW],
    [REVIEWS]: [CANNED_REVIEW_ROW],
  });
}

/**
 * The catalogs module is mocked rather than driven through the recording
 * fetch: `getLabels` is cache()-wrapped, so it cannot take a `db` seam. See
 * ADR-0001 on the cache rule.
 */
function stubCatalogs(
  genders: Record<string, string> = { male: "Male", female: "Female" },
  civilStatuses: Record<string, string> = { married: "Married", single: "Single" },
) {
  return vi
    .spyOn(catalogs, "getLabels")
    .mockImplementation(async (view) =>
      view === "public_genders" ? genders : civilStatuses,
    );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getReviewDossier", () => {
  it("returns nothing when the application does not exist or is not visible", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({});

    expect(await getReviewDossier(APP_ID, createTestClient(fetch))).toBeNull();
  });

  it("does not fire any other read when there is nothing to show", async () => {
    const getLabels = stubCatalogs();
    const { fetch, requests } = createTableFetch({});

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requests.map((request) => request.table)).toEqual([APPLICATIONS]);
    expect(getLabels).not.toHaveBeenCalled();
  });

  it("carries the application, its live documents and the latest decision", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requests.map((request) => request.table).sort()).toEqual(
      [APPLICATIONS, DOCUMENTS, REVIEWS].sort(),
    );
    expect(dossier?.application.reference_number).toBe("YC-2026-000123");
    expect(dossier?.documents).toHaveLength(1);
    expect(dossier?.documents[0].document_type_label).toBe("Valid Voter's ID");
    expect(dossier?.latestReview?.reason).toBe("The voter ID photo is too blurred to read.");
  });

  it("resolves the gender and civil status codes to catalog labels", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({ [APPLICATIONS]: [CANNED_APPLICATION_ROW] });

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.genderLabel).toBe("Female");
    expect(dossier?.civilStatusLabel).toBe("Married");
  });

  /**
   * Flat, and the labels named separately. Folding them onto the application
   * would put a hand-resolved label beside document_type_label, which the view
   * resolves — the same thing to read and not the same thing at all. The staff
   * user is absent on purpose: it answers "who is looking", not "what is being
   * looked at", so the route still reads it itself.
   */
  it("names the labels beside the application rather than folding them onto it", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({ [APPLICATIONS]: [CANNED_APPLICATION_ROW] });

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(Object.keys(dossier!).sort()).toEqual([
      "application",
      "civilStatusLabel",
      "documents",
      "genderLabel",
      "latestReview",
      "replacedCardApplicationId",
      "supersedingCorrection",
    ]);
    expect(dossier!.application).not.toHaveProperty("genderLabel");
  });

  /** Resolution is ours, presentation is the caller's. */
  it("returns the raw byte count for the caller to format", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({
      [APPLICATIONS]: [CANNED_APPLICATION_ROW],
      [DOCUMENTS]: [CANNED_DOCUMENT_ROW],
    });

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.documents[0].byte_size).toBe(204_800);
  });

  /**
   * Two ordinary first states, not failures: an application with nothing
   * attached yet, and one nobody has reviewed. The list renders its empty
   * state and the banner does not render.
   */
  it("reports no documents and no decision as empty rather than as missing", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({ [APPLICATIONS]: [CANNED_APPLICATION_ROW] });

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.documents).toEqual([]);
    expect(dossier?.latestReview).toBeNull();
  });

  it("falls back to the raw code when the catalog has no label for it", async () => {
    stubCatalogs({ male: "Male" }, { single: "Single" });
    const { fetch } = createTableFetch({
      [APPLICATIONS]: [{ ...CANNED_APPLICATION_ROW, civil_status_code: "annulled" }],
    });

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.civilStatusLabel).toBe("annulled");
  });

  /**
   * getLabels swallows its own read failure and returns an empty map, so a
   * catalog the reviewer cannot reach degrades to the raw code by the same
   * route a missing entry does. An unreachable lookup table must not fail the
   * page.
   */
  it("falls back to the raw code when a catalog read failed", async () => {
    stubCatalogs({}, {});
    const { fetch } = createTableFetch({ [APPLICATIONS]: [CANNED_APPLICATION_ROW] });

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.genderLabel).toBe("female");
    expect(dossier?.civilStatusLabel).toBe("married");
  });

  /**
   * A failed read must not be mistaken for a missing application: that renders
   * a 404 over a row that is sitting right there.
   */
  it("raises when the application read fails rather than reporting nothing to show", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({}, {
      table: APPLICATIONS,
      message: "permission denied for view staff_yellow_card_queue",
    });

    await expect(getReviewDossier(APP_ID, createTestClient(fetch))).rejects.toThrow(
      /staff_yellow_card_queue detail read failed: permission denied/,
    );
  });

  /**
   * Partial degradation is rejected: a reviewer deciding against an incomplete
   * picture, with nothing on screen saying so, is the failure mode the
   * `superseded_by is null` filter exists to prevent.
   */
  it("raises when a document read fails rather than showing an incomplete picture", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({ [APPLICATIONS]: [CANNED_APPLICATION_ROW] }, {
      table: DOCUMENTS,
      message: "permission denied for view staff_yellow_card_documents",
    });

    await expect(getReviewDossier(APP_ID, createTestClient(fetch))).rejects.toThrow(
      /staff_yellow_card_documents read failed: permission denied/,
    );
  });

  /**
   * Reported as "nobody has reviewed this yet", the banner quoting the last
   * decision vanishes from a screen that has been round the loop three times —
   * and the reviewer reads that as a first submission.
   */
  it("raises when the latest review read fails rather than reporting no review", async () => {
    stubCatalogs();
    const { fetch } = createTableFetch({ [APPLICATIONS]: [CANNED_APPLICATION_ROW] }, {
      table: REVIEWS,
      message: "permission denied for view staff_yellow_card_reviews",
    });

    await expect(getReviewDossier(APP_ID, createTestClient(fetch))).rejects.toThrow(
      /staff_yellow_card_reviews read failed: permission denied/,
    );
  });
});

// ---------------------------------------------------------------------------
// The three composed reads. Private to this module, so their query shapes are
// asserted through the dossier — the only way in that is left.
// ---------------------------------------------------------------------------

describe("getReviewDossier — the application read", () => {
  it("reads the staff_yellow_card_queue view", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    requestTo(requests, APPLICATIONS);
  });

  /**
   * The detail screen shows every field a reviewer uses to decide, so a
   * refactor must not quietly drop one. Adding a column here is meant to cost
   * something: it sends the author back to verify the name against the live
   * view first.
   */
  it("selects the exact column list", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, APPLICATIONS))).toEqual([
      "id",
      "reference_number",
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "barangay_name",
      "status",
      "submitted_at",
      "due_at",
      "document_count",
      "deadline_state",
      "date_of_birth",
      "gender_code",
      "civil_status_code",
      "complete_address",
      "contact_number",
      "email_address",
      "years_of_residency",
      "voter_id_number",
      "privacy_consent",
      "needs_dedup_review",
      "decided_at",
      "review_cycles",
      "is_correction",
      "replaces_card_id",
      "replaced_card_number",
      "replaced_card_status",
      "correction_note",
      "holds_printed_card",
      "printed_card_number",
      "card_id",
      "card_number",
      "card_status",
      "card_holder_name",
      "card_issued_on",
      "card_revoked_reason",
      "card_revoked_by_name",
      "card_revoked_at",
      "card_superseded_by_number",
      "card_superseded_by_reference",
    ]);
  });

  it("filters by the requested id", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requestTo(requests, APPLICATIONS).filters["id"]).toEqual([`eq.${APP_ID}`]);
  });

  it("maps the canned row through the row mapper", async () => {
    stubCatalogs();
    const { fetch } = createFullDossierFetch();

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.application).toMatchObject({
      id: APP_ID,
      reference_number: "YC-2026-000123",
      complete_address: "12 Quezon Ave, Ibabang Dupay, Lucena City",
      years_of_residency: 15,
      privacy_consent: true,
      decided_at: null,
    });
  });
});

describe("getReviewDossier — the live documents read", () => {
  it("reads the staff_yellow_card_documents view", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    requestTo(requests, DOCUMENTS);
  });

  it("selects the exact column list", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, DOCUMENTS))).toEqual([
      "id",
      "application_id",
      "document_type_code",
      "document_type_label",
      "original_filename",
      "mime_type",
      "byte_size",
      "uploaded_at",
      "superseded_by",
    ]);
  });

  it("filters by application_id", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requestTo(requests, DOCUMENTS).filters["application_id"]).toEqual([`eq.${APP_ID}`]);
  });

  /**
   * When a citizen resubmits, the replaced upload stays in the table pointing
   * at the one that replaced it. Without this filter a reviewer is shown the
   * photo they already rejected alongside the new one, with nothing to tell
   * them apart.
   */
  it("filters out superseded uploads", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requestTo(requests, DOCUMENTS).filters["superseded_by"]).toEqual(["is.null"]);
  });

  it("orders by uploaded_at ascending", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requestTo(requests, DOCUMENTS).order).toContain("uploaded_at.asc");
  });

  it("maps the canned row through the row mapper", async () => {
    stubCatalogs();
    const { fetch } = createFullDossierFetch();

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.documents).toEqual([
      {
        id: "doc-1",
        document_type_code: "voter_id",
        document_type_label: "Valid Voter's ID",
        original_filename: "voter-id.jpg",
        mime_type: "image/jpeg",
        byte_size: 204_800,
        uploaded_at: "2026-06-28T16:23:45.547482+00:00",
      },
    ]);
  });
});

describe("getReviewDossier — the latest review read", () => {
  it("reads the staff_yellow_card_reviews view", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    requestTo(requests, REVIEWS);
  });

  it("selects the exact column list", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, REVIEWS))).toEqual([
      "id",
      "application_id",
      "decision",
      "reason",
      "reviewed_at",
      "reviewed_by_name",
    ]);
  });

  it("filters by application_id", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requestTo(requests, REVIEWS).filters["application_id"]).toEqual([`eq.${APP_ID}`]);
  });

  /**
   * The context banner quotes this decision as the current one. Ordered the
   * other way it would quote the first review of an application that has been
   * round the loop three times.
   */
  it("takes the most recent decision first", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requestTo(requests, REVIEWS).order).toBe("reviewed_at.desc");
  });

  /** One decision is quoted, so one row is asked for. */
  it("asks for a single row", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(requestTo(requests, REVIEWS).limit).toBe("1");
  });

  it("maps the canned row through the row mapper", async () => {
    stubCatalogs();
    const { fetch } = createFullDossierFetch();

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.latestReview).toEqual({
      id: "review-2",
      decision: "revise",
      reason: "The voter ID photo is too blurred to read.",
      reviewed_at: "2026-08-03T07:45:12.000000+00:00",
      reviewed_by_name: "Ana Reyes",
    });
  });
});

// ---------------------------------------------------------------------------
// The Correction that replaced a superseded card
// ---------------------------------------------------------------------------

/**
 * A superseded card names its successor by the Correction's YC- reference,
 * not its application id, and carries no date. The review page links by id
 * and says "on <date>", so the dossier reads that Correction's row — once, and
 * only for a superseded card.
 */
describe("getReviewDossier — the superseding Correction read", () => {
  const SUPERSEDED_ROW: StaffYellowCardApplicationRow = {
    ...CANNED_APPLICATION_ROW,
    status: "approved",
    decided_at: "2026-11-12T03:00:00.000000+00:00",
    card_id: "card-45",
    card_number: "LC-2026-000045",
    card_status: "superseded",
    card_holder_name: "Maria Dela Cruz",
    card_issued_on: "2026-11-12",
    card_superseded_by_number: "LC-2026-000312",
    card_superseded_by_reference: "YC-2026-000210",
  };

  const CORRECTION_ID = "9b0e7c1e-2f43-4c5a-9a51-0c8f6c1d2e3f";

  /**
   * Both reads go to staff_yellow_card_queue, so they are told apart by their
   * filter: the Correction is looked up by reference_number, the application
   * by id.
   */
  function createSupersededFetch(correction: unknown[]) {
    const requests: ParsedQueryParams[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const params = parseQueryParams(new Request(input, init).url);
      requests.push(params);
      const body =
        params.table !== APPLICATIONS
          ? []
          : params.filters["reference_number"]
            ? correction
            : [SUPERSEDED_ROW];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    return { fetch, requests };
  }

  it("reads the Correction's id and approval time by its reference", async () => {
    stubCatalogs();
    const { fetch, requests } = createSupersededFetch([
      { id: CORRECTION_ID, decided_at: "2026-11-20T06:30:00.000000+00:00" },
    ]);

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    const lookup = requests.find((request) => request.filters["reference_number"]);
    expect(lookup?.table).toBe(APPLICATIONS);
    expect(lookup?.filters["reference_number"]).toEqual(["eq.YC-2026-000210"]);
    expect(columnsOf(lookup!)).toEqual(["id", "decided_at"]);
    expect(dossier?.supersedingCorrection).toEqual({
      id: CORRECTION_ID,
      decided_at: "2026-11-20T06:30:00.000000+00:00",
    });
  });

  /** Not visible, or gone: the page still names the card, without a link. */
  it("reports no Correction when the reference finds no row", async () => {
    stubCatalogs();
    const { fetch } = createSupersededFetch([]);

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.supersedingCorrection).toBeNull();
  });

  it.each(["active", "revoked"] as const)(
    "makes no extra read for a %s card",
    async (status) => {
      stubCatalogs();
      const { fetch, requests } = createTableFetch({
        [APPLICATIONS]: [{ ...SUPERSEDED_ROW, card_status: status }],
      });

      const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

      requestTo(requests, APPLICATIONS);
      expect(dossier?.supersedingCorrection).toBeNull();
    },
  );
});

/**
 * A Correction names the card it replaces by the card's id. The review page
 * links "Replaces …" to the application that issued that card, so the dossier
 * reads that application's id by its card_id — once, and only for a
 * Correction.
 */
describe("getReviewDossier — the replaced card's application read", () => {
  const REPLACED_CARD_ID = "c1d2e3f4-0000-4000-8000-000000000045";
  const ISSUER_ID = "6a1f0d2c-8e3b-4f7a-b1c2-3d4e5f607182";

  const CORRECTION_ROW: StaffYellowCardApplicationRow = {
    ...CANNED_APPLICATION_ROW,
    reference_number: "YC-2026-000210",
    is_correction: true,
    replaces_card_id: REPLACED_CARD_ID,
    replaced_card_number: "LC-2026-000045",
    replaced_card_status: "active",
    correction_note: "My surname is misspelled.",
  };

  /**
   * Both reads go to staff_yellow_card_queue, so they are told apart by their
   * filter: the issuer is looked up by card_id, the application by id.
   */
  function createCorrectionFetch(issuer: unknown[]) {
    const requests: ParsedQueryParams[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const params = parseQueryParams(new Request(input, init).url);
      requests.push(params);
      const body =
        params.table !== APPLICATIONS
          ? []
          : params.filters["card_id"]
            ? issuer
            : [CORRECTION_ROW];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    return { fetch, requests };
  }

  it("reads the issuing application's id by the replaced card's id", async () => {
    stubCatalogs();
    const { fetch, requests } = createCorrectionFetch([{ id: ISSUER_ID }]);

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    const lookup = requests.find((request) => request.filters["card_id"]);
    expect(lookup?.table).toBe(APPLICATIONS);
    expect(lookup?.filters["card_id"]).toEqual([`eq.${REPLACED_CARD_ID}`]);
    expect(columnsOf(lookup!)).toEqual(["id"]);
    expect(dossier?.replacedCardApplicationId).toBe(ISSUER_ID);
  });

  /** Not visible, or gone: the page still names the card, without a link. */
  it("reports no application when the card id finds no row", async () => {
    stubCatalogs();
    const { fetch } = createCorrectionFetch([]);

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    expect(dossier?.replacedCardApplicationId).toBeNull();
  });

  it("makes no extra read for a first application", async () => {
    stubCatalogs();
    const { fetch, requests } = createFullDossierFetch();

    const dossier = await getReviewDossier(APP_ID, createTestClient(fetch));

    requestTo(requests, APPLICATIONS);
    expect(dossier?.replacedCardApplicationId).toBeNull();
  });

  it("raises when the read fails rather than dropping the link silently", async () => {
    stubCatalogs();
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const params = parseQueryParams(new Request(input, init).url);
      if (params.table === APPLICATIONS && params.filters["card_id"]) {
        return new Response(JSON.stringify({ message: "permission denied", code: "42501" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(params.table === APPLICATIONS ? [CORRECTION_ROW] : []), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await expect(getReviewDossier(APP_ID, createTestClient(fetch))).rejects.toThrow(
      /staff_yellow_card_queue replaced card read failed: permission denied/,
    );
  });
});
