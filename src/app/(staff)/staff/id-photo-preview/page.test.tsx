import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import IdPhotoPreviewPage from "./page";

describe("IdPhotoPreviewPage", () => {
  it("renders the generic placeholder text", () => {
    render(<IdPhotoPreviewPage />);
    expect(screen.getByText("Picture Here")).toBeInTheDocument();
  });
});
