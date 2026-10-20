import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AfterPhotos } from "@/portals/responder/features/incidents/components/after-photos";
import { AddPhotoSheet } from "@/portals/responder/features/incidents/components/add-photo-sheet";
vi.mock("@/portals/responder/features/incidents/actions", () => ({
  requestAfterPhoto: vi.fn(),
  confirmAfterPhoto: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/** The real cap is 3 (max_photos_per_cycle), not the 6 the app used to allow. */
const MAX = 3;

const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `photo-${i}`,
    url: `https://example.test/${i}.jpg`,
  }));

describe("AfterPhotos", () => {
  const props = { maxPhotos: MAX, incidentId: "inc-1" };

  it("states the requirement and warns while it is unmet", () => {
    render(<AfterPhotos photos={[]} {...props} />);

    expect(
      screen.getByText("After photo · required to resolve"),
    ).toBeInTheDocument();
    expect(screen.getByText("Photo required")).toBeInTheDocument();
    expect(screen.queryByText("Ready to resolve")).not.toBeInTheDocument();
  });

  it("flips the pill once there is evidence", () => {
    render(<AfterPhotos photos={photos(1)} {...props} />);

    expect(screen.getByText("Ready to resolve")).toBeInTheDocument();
    expect(screen.queryByText("Photo required")).not.toBeInTheDocument();
  });

  it("shows the picture, not a filename", () => {
    // A tile that only says "IMG_2470.jpg" cannot tell a responder whether they
    // photographed the right thing.
    render(<AfterPhotos photos={photos(2)} {...props} />);

    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("tells the responder the cap before they hit it", () => {
    // Story 34: told the number and stopped at it, rather than losing an upload
    // to a limit they did not know about.
    render(<AfterPhotos photos={photos(2)} {...props} />);

    expect(screen.getByText("2 of 3 attached this cycle.")).toBeInTheDocument();
  });

  it("offers NO remove button, because no bucket exposes delete", () => {
    // Story 36 cannot be satisfied: storage.objects carries only SELECT and
    // INSERT policies. A remove button would 403, so the affordance is gone
    // rather than left to fail. Restoring it needs a DB-repo follow-up.
    render(<AfterPhotos photos={photos(2)} {...props} />);

    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });

  it("links the add slot at the photo sheet", () => {
    render(<AfterPhotos photos={[]} {...props} />);

    expect(screen.getByRole("link", { name: "Add photo" })).toHaveAttribute(
      "href",
      "/responder/my-ticket?sheet=photo&incidentId=inc-1",
    );
  });

  it("withdraws the add slot at the cap", () => {
    render(<AfterPhotos photos={photos(MAX)} {...props} />);

    expect(
      screen.queryByRole("link", { name: "Add photo" }),
    ).not.toBeInTheDocument();
  });
});

describe("AddPhotoSheet", () => {
  it("offers camera and gallery, and asks for the shot the citizen framed", () => {
    render(<AddPhotoSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

    expect(screen.getByText("Add the after photo")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Shoot the finished work from roughly where the citizen's photo was taken.",
      ),
    ).toBeInTheDocument();

    const camera = screen.getByLabelText("Camera");
    const gallery = screen.getByLabelText("Gallery");

    expect(camera).toHaveAttribute("capture", "environment");
    expect(gallery).not.toHaveAttribute("capture");
  });

  it.each(["Camera", "Gallery"])(
    "%s accepts only the photo formats the upload RPC will take",
    (source) => {
      // request_incident_photo_upload rejects anything else with 22023, so the
      // picker stops the responder rather than a banner after they choose.
      // It also takes PDF, but a PDF is not a photo the citizen can confirm
      // against (SCRUM-191), so the picker is narrower than the RPC.
      render(<AddPhotoSheet closeHref="/responder/my-ticket" incidentId="inc-1" />);

      const accept = screen.getByLabelText(source).getAttribute("accept")!;

      expect(accept.split(",").sort()).toEqual(
        [".jpeg", ".jpg", ".png", "image/jpeg", "image/png"].sort(),
      );
    },
  );
});
