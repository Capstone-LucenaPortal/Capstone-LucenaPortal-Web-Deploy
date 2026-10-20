import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AfterPhotoUploader } from "./after-photo-uploader";

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

function pick(label: string) {
  const file = new File(["x"], "after.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
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
    requestAfterPhoto.mockResolvedValue({
      ok: true,
      bucket: "b",
      path: "p",
      rowId: "r1",
    });
    confirmAfterPhoto.mockResolvedValue({ ok: true, notice: null });
    render(<AfterPhotoUploader incidentId="i1" />);

    pick("Gallery");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/responder/my-ticket"));
    expect(confirmAfterPhoto).toHaveBeenCalledWith("r1", 1, "image/jpeg");
  });
});
