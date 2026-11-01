import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AfterPhotoUploader, MAX_PHOTO_BYTES } from "./after-photo-uploader";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const requestAfterPhoto = vi.fn();
const confirmAfterPhoto = vi.fn();
vi.mock("@/portals/responder/features/incidents/actions", () => ({
  requestAfterPhoto: (...args: unknown[]) => requestAfterPhoto(...args),
  confirmAfterPhoto: (...args: unknown[]) => confirmAfterPhoto(...args),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
  }),
}));

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

function pick(label: string, bytes = 1) {
  const file = new File([new Uint8Array(bytes)], "after.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

function reserveAndConfirmOk() {
  requestAfterPhoto.mockResolvedValue({
    ok: true,
    bucket: "b",
    path: "p",
    rowId: "r1",
  });
  confirmAfterPhoto.mockResolvedValue({ ok: true, notice: null });
}

afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
  refresh.mockClear();
  requestAfterPhoto.mockReset();
  confirmAfterPhoto.mockReset();
});

describe("AfterPhotoUploader", () => {
  // Picking a 4 MB photo only to have the reserve fail is a wasted minute at
  // the roadside; say so before the picker opens.
  it("is unavailable while offline, and says why", () => {
    setOnline(false);
    render(<AfterPhotoUploader incidentId="i1" />);

    expect(screen.getByLabelText("Camera")).toBeDisabled();
    expect(screen.getByLabelText("Gallery")).toBeDisabled();
    expect(screen.getAllByText(/offline/i)).toHaveLength(2);
  });

  // A server action that cannot reach the server throws rather than returning
  // a notice. Without a catch the buttons stay on "Uploading…" for good.
  it("says the upload failed, and frees the buttons, when an action throws", async () => {
    setOnline(true);
    requestAfterPhoto.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AfterPhotoUploader incidentId="i1" />);

    pick("Camera");

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/responder/my-ticket?notice=upload_failed"),
    );
    expect(screen.getByLabelText("Camera")).not.toBeDisabled();
  });

  it("attaches the photo when every step succeeds", async () => {
    setOnline(true);
    reserveAndConfirmOk();
    render(<AfterPhotoUploader incidentId="i1" />);

    pick("Gallery");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/responder/my-ticket"));
    expect(confirmAfterPhoto).toHaveBeenCalledWith("r1", 1, "image/jpeg");
  });

  // Issue #66: an oversized file used to reserve a slot, upload in full and
  // fail at the bucket. Refused here, it never reaches the 3-per-cycle cap.
  it("refuses a photo over 5 MB before reserving a slot, and says why", async () => {
    setOnline(true);
    render(<AfterPhotoUploader incidentId="i1" />);

    pick("Gallery", MAX_PHOTO_BYTES + 1);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/responder/my-ticket?sheet=photo&notice=photo_too_large",
      ),
    );
    expect(requestAfterPhoto).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Gallery")).not.toBeDisabled();
  });

  it("accepts a photo of exactly 5 MB, the bucket's own limit", async () => {
    setOnline(true);
    reserveAndConfirmOk();
    render(<AfterPhotoUploader incidentId="i1" />);

    pick("Gallery", MAX_PHOTO_BYTES);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/responder/my-ticket"));
    expect(requestAfterPhoto).toHaveBeenCalledWith("i1", "jpg");
    expect(confirmAfterPhoto).toHaveBeenCalledWith("r1", MAX_PHOTO_BYTES, "image/jpeg");
  });

  it("refuses an empty file without reserving", async () => {
    setOnline(true);
    render(<AfterPhotoUploader incidentId="i1" />);

    pick("Camera", 0);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/responder/my-ticket?sheet=photo&notice=upload_failed",
      ),
    );
    expect(requestAfterPhoto).not.toHaveBeenCalled();
  });

  it("attaches a valid photo picked after an oversized one was refused", async () => {
    setOnline(true);
    reserveAndConfirmOk();
    render(<AfterPhotoUploader incidentId="i1" />);

    pick("Gallery", MAX_PHOTO_BYTES + 1);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/responder/my-ticket?sheet=photo&notice=photo_too_large",
      ),
    );

    pick("Gallery");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/responder/my-ticket"));
    expect(requestAfterPhoto).toHaveBeenCalledTimes(1);
  });
});
