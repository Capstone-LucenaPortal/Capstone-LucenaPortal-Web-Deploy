import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhotoGrid } from "@/portals/responder/features/incidents/components/photo-grid";

describe("PhotoGrid", () => {
  it("renders one tile per photo, from the URL it was handed", () => {
    render(
      <PhotoGrid
        photos={[
          { id: "a", url: "https://example.test/a.jpg" },
          { id: "b", url: "https://example.test/b.jpg" },
        ]}
        alt="Citizen photo"
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "https://example.test/a.jpg");
  });

  it("shows a placeholder tile where the URL could not be signed", () => {
    // getPhotoUrl returns null rather than throwing on a miss: an unreadable
    // photo should render as a missing tile, not take down the page around it.
    render(
      <PhotoGrid
        photos={[
          { id: "a", url: "https://example.test/a.jpg" },
          { id: "b", url: null },
        ]}
        alt="Citizen photo"
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("renders nothing at all when there are no photos", () => {
    const { container } = render(<PhotoGrid photos={[]} alt="Citizen photo" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("numbers the alt text so two tiles are distinguishable to a screen reader", () => {
    render(
      <PhotoGrid
        photos={[
          { id: "a", url: "https://example.test/a.jpg" },
          { id: "b", url: "https://example.test/b.jpg" },
        ]}
        alt="After photo"
      />,
    );

    expect(screen.getByAltText("After photo 1 of 2")).toBeInTheDocument();
    expect(screen.getByAltText("After photo 2 of 2")).toBeInTheDocument();
  });

  it("puts a trailing tile in the same row as the photos", () => {
    // SCRUM-191: the add tile lived in a second grid, so it wrapped below the
    // first photo instead of sitting beside it.
    render(
      <PhotoGrid
        photos={[{ id: "a", url: "https://example.test/a.jpg" }]}
        alt="After photo"
      >
        <a href="#add">Add photo</a>
      </PhotoGrid>,
    );

    expect(screen.getByRole("link", { name: "Add photo" }).parentElement).toBe(
      screen.getByAltText("After photo 1 of 1").parentElement,
    );
  });

  it("still renders a trailing tile when there are no photos", () => {
    render(
      <PhotoGrid photos={[]} alt="After photo">
        <a href="#add">Add photo</a>
      </PhotoGrid>,
    );

    expect(screen.getByRole("link", { name: "Add photo" })).toBeInTheDocument();
  });
});
