import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceStrip } from "./evidence-strip";
import type { IncidentPhoto } from "../types";

function photo(over: Partial<IncidentPhoto> = {}): IncidentPhoto {
  return {
    id: "00000000-0000-4444-8000-000000000001",
    kind: "before",
    cycle_number: 1,
    mime_type: "image/jpeg",
    size_bytes: 84000,
    uploaded_at: "2026-08-07T07:00:00+08:00",
    uploaded_by_name: "Linda",
    ...over,
  };
}

describe("EvidenceStrip", () => {
  it("explains an empty strip in terms of what it means", () => {
    // Not "no photos" — no photo is why the report is unverified and why no
    // clock is running, which is the thing a triage officer needs to know.
    render(<EvidenceStrip photos={[]} isVerified={false} />);
    expect(
      screen.getByText(/no evidence photo yet/i),
    ).toBeInTheDocument();
  });

  it("groups before and after", () => {
    render(
      <EvidenceStrip
        photos={[photo(), photo({ id: "b", kind: "after", uploaded_by_name: "Ernesto" })]}
        isVerified
      />,
    );
    expect(screen.getByText(/Reported/)).toBeInTheDocument();
    expect(screen.getByText(/Resolved/)).toBeInTheDocument();
  });

  it("links each photo through the proxy route and opens it in a new tab", () => {
    render(<EvidenceStrip photos={[photo()]} isVerified />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "/staff/api/incidents/photos/00000000-0000-4444-8000-000000000001",
    );
    expect(link).toHaveAttribute("target", "_blank");
    // Without this a compromised endpoint could reach back through
    // window.opener into the portal tab.
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("previews each photo as a thumbnail from the same proxy route", () => {
    // A text link ("Open photo") made the officer open a tab to learn whether
    // the photo showed anything at all. SCRUM-193.
    render(
      <EvidenceStrip
        photos={[photo(), photo({ id: "b", uploaded_by_name: "Ernesto" })]}
        isVerified
      />,
    );
    const [first, second] = screen.getAllByRole("img");
    expect(first).toHaveAttribute(
      "src",
      "/staff/api/incidents/photos/00000000-0000-4444-8000-000000000001",
    );
    expect(first).toHaveAccessibleName("Reported photo 1 of 2");
    expect(second).toHaveAccessibleName("Reported photo 2 of 2");
    expect(screen.queryByText("Open photo")).not.toBeInTheDocument();
  });

  it("attributes each photo", () => {
    render(<EvidenceStrip photos={[photo()]} isVerified />);
    const link = screen.getByRole("link");
    expect(within(link).getByText(/Linda/)).toBeInTheDocument();
  });
});
