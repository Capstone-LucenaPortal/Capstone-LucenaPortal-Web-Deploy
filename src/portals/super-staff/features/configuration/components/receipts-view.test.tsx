import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import { UnsavedChangesProvider } from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import type { Officer, OfficerService } from "../lib/receipts-types";
import { ReceiptsView } from "./receipts-view";

// Tested at the module boundary: the reads, the one RPC call site and the
// storage seam's network half are mocked; everything between them and the DOM
// is real. No test here may reach the sandbox — a saved officer stops being a
// placeholder for good, and an uploaded seal can never be removed.

const callRpc = vi.fn();
const getOfficer = vi.fn();
const getAgencyIdentity = vi.fn();
const putSeal = vi.fn();
const putImage = vi.fn();
const push = vi.fn();

vi.mock("@/portals/super-staff/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));

vi.mock("../lib/receipts-queries", () => ({
  getOfficer: (service: OfficerService) => getOfficer(service),
  getAgencyIdentity: () => getAgencyIdentity(),
}));

vi.mock("@/portals/super-staff/lib/storage/site-content", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/portals/super-staff/lib/storage/site-content")
  >();
  return {
    ...actual,
    imageSrc: (path: string | null) => (path ? `https://cdn.test/${path}` : null),
    putSeal: (file: File) => putSeal(file),
    putImage: (...args: unknown[]) => putImage(...args),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-staff/configuration/receipts",
  useRouter: () => ({ push }),
}));

const placeholder = (service: OfficerService): Officer => ({
  service,
  fullName: "To be nominated",
  unit: "Pending nomination (SCRUM-105)",
  designation: "Officer of Record",
  isPlaceholder: true,
});

const officers: Record<OfficerService, Officer> = {
  yellow_card: placeholder("yellow_card"),
  incidents: {
    service: "incidents",
    fullName: "Jose Rizal",
    unit: "CDRRMO",
    designation: "Department Head",
    isPlaceholder: false,
  },
  booking: placeholder("booking"),
};

const card = (name: string) => screen.getByRole("region", { name });

async function renderView() {
  render(
    <ToastProvider>
      <UnsavedChangesProvider>
        <ReceiptsView />
      </UnsavedChangesProvider>
    </ToastProvider>,
  );
  await screen.findByDisplayValue("Jose Rizal");
  await screen.findByDisplayValue("City Government of Lucena");
}

beforeEach(() => {
  vi.clearAllMocks();
  callRpc.mockResolvedValue({});
  getOfficer.mockImplementation(async (s: OfficerService) => officers[s]);
  getAgencyIdentity.mockResolvedValue({
    agencyName: "City Government of Lucena",
    sealPath: "agency/seal.png",
  });
});

describe("ReceiptsView — Officers of Record", () => {
  it("shows the Receipts tab and one card per service, in order, placeholders marked", async () => {
    await renderView();

    expect(screen.getByRole("button", { name: "Receipts" })).toBeInTheDocument();

    const titles = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label"));
    expect(titles).toEqual([
      "Yellow Card Officer of Record",
      "Incidents Officer of Record",
      "Booking Officer of Record",
      "Agency identity",
    ]);

    expect(
      within(card("Yellow Card Officer of Record")).getByText("Placeholder: not yet nominated"),
    ).toBeInTheDocument();
    expect(
      within(card("Incidents Officer of Record")).queryByText("Placeholder: not yet nominated"),
    ).toBeNull();
  });

  it("saves one officer on its own, after a one-way, future-only confirm", async () => {
    const user = userEvent.setup();
    await renderView();

    const yellow = card("Yellow Card Officer of Record");
    const incidents = card("Incidents Officer of Record");

    // An edit on a second card must not ride along with the first card's save.
    const incidentsName = within(incidents).getByLabelText("Name");
    await user.clear(incidentsName);
    await user.type(incidentsName, "Andres Bonifacio");

    await user.clear(within(yellow).getByLabelText("Name"));
    await user.type(within(yellow).getByLabelText("Name"), " Maria Santos ");
    await user.clear(within(yellow).getByLabelText("Unit"));
    await user.type(within(yellow).getByLabelText("Unit"), "City Health Office");
    await user.click(within(yellow).getByRole("button", { name: "Save" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("To be nominated")).toBeInTheDocument();
    expect(within(dialog).getByText("Maria Santos")).toBeInTheDocument();
    expect(within(dialog).getByText("City Health Office")).toBeInTheDocument();
    expect(within(dialog).queryByText("Andres Bonifacio")).toBeNull();
    expect(within(dialog).getByText(/one-way/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/no longer a placeholder/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/future receipts only/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/already issued keep the officer/i)).toBeInTheDocument();
    expect(callRpc).not.toHaveBeenCalled();

    // The save re-reads the officer, as the other configuration tabs do.
    getOfficer.mockResolvedValueOnce({
      service: "yellow_card",
      fullName: "Maria Santos",
      unit: "City Health Office",
      designation: "Officer of Record",
      isPlaceholder: false,
    });
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(callRpc).toHaveBeenCalledExactlyOnceWith("update_officer_of_record", {
      p_service: "yellow_card",
      p_full_name: "Maria Santos",
      p_unit: "City Health Office",
      p_designation: "Officer of Record",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(yellow).getByLabelText("Name")).toHaveValue("Maria Santos");
    expect(within(yellow).queryByText("Placeholder: not yet nominated")).toBeNull();
    // The other card keeps its unsaved edit.
    expect(within(incidents).getByLabelText("Name")).toHaveValue("Andres Bonifacio");
  });

  it("blocks empty and over-long fields inline, before any RPC", async () => {
    const user = userEvent.setup();
    await renderView();

    const booking = card("Booking Officer of Record");
    await user.clear(within(booking).getByLabelText("Name"));
    fireEvent.change(within(booking).getByLabelText("Unit"), {
      target: { value: "u".repeat(201) },
    });
    fireEvent.change(within(booking).getByLabelText("Designation"), {
      target: { value: "d".repeat(121) },
    });
    await user.click(within(booking).getByRole("button", { name: "Save" }));

    expect(within(booking).getByText("Enter a name.")).toBeInTheDocument();
    expect(within(booking).getByText("At most 200 characters.")).toBeInTheDocument();
    expect(within(booking).getByText("At most 120 characters.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(callRpc).not.toHaveBeenCalled();
  });
});

describe("ReceiptsView — Agency identity", () => {
  it("saves a new agency name with the current seal path unchanged", async () => {
    const user = userEvent.setup();
    await renderView();

    const agency = card("Agency identity");
    await user.clear(within(agency).getByLabelText("Agency name"));
    await user.type(within(agency).getByLabelText("Agency name"), "Lungsod ng Lucena");
    await user.click(within(agency).getByRole("button", { name: "Save" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("City Government of Lucena")).toBeInTheDocument();
    expect(within(dialog).getByText("Lungsod ng Lucena")).toBeInTheDocument();
    // The seal did not change, so the dialog makes no claim about it.
    expect(within(dialog).queryByText(/old seal stays/i)).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(callRpc).toHaveBeenCalledExactlyOnceWith("save_agency_identity", {
      p_agency_name: "Lungsod ng Lucena",
      p_seal_path: "agency/seal.png",
    });
  });

  it("uploads a replacement seal to a new path, then saves that path", async () => {
    const user = userEvent.setup();
    putSeal.mockResolvedValue("agency/seal-1795161600000-abcdef01.png");
    await renderView();

    const agency = card("Agency identity");
    expect(within(agency).getByRole("img", { name: "Seal preview" })).toHaveAttribute(
      "src",
      "https://cdn.test/agency/seal.png",
    );

    const file = new File(["png"], "seal.png", { type: "image/png" });
    await user.upload(within(agency).getByLabelText("Seal file"), file);

    expect(putSeal).toHaveBeenCalledExactlyOnceWith(file);
    expect(putImage).not.toHaveBeenCalled();
    expect(within(agency).getByRole("img", { name: "Seal preview" })).toHaveAttribute(
      "src",
      "https://cdn.test/agency/seal-1795161600000-abcdef01.png",
    );
    // Uploading alone changes no receipt.
    expect(callRpc).not.toHaveBeenCalled();

    await user.click(within(agency).getByRole("button", { name: "Save" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "Seal before" })).toHaveAttribute(
      "src",
      "https://cdn.test/agency/seal.png",
    );
    expect(within(dialog).getByRole("img", { name: "Seal after" })).toHaveAttribute(
      "src",
      "https://cdn.test/agency/seal-1795161600000-abcdef01.png",
    );
    expect(within(dialog).getByText(/old seal stays/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/never deleted/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(callRpc).toHaveBeenCalledExactlyOnceWith("save_agency_identity", {
      p_agency_name: "City Government of Lucena",
      p_seal_path: "agency/seal-1795161600000-abcdef01.png",
    });
  });

  it("refuses a seal the bucket would refuse, without uploading", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderView();

    const agency = card("Agency identity");
    await user.upload(
      within(agency).getByLabelText("Seal file"),
      new File(["webp"], "seal.webp", { type: "image/webp" }),
    );

    expect(within(agency).getByText("Use a JPEG or PNG image.")).toBeInTheDocument();
    expect(putSeal).not.toHaveBeenCalled();
  });
});

describe("ReceiptsView — unsaved changes", () => {
  it("asks before leaving the tab with an unsaved officer edit", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.type(
      within(card("Incidents Officer of Record")).getByLabelText("Designation"),
      " II",
    );
    await user.click(screen.getByRole("button", { name: "Site Info" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves at once when nothing is unsaved", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("button", { name: "Site Info" }));

    expect(push).toHaveBeenCalledWith("/super-staff/configuration/site-info");
  });
});
