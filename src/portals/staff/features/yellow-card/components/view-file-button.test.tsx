import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewFileButton } from "./view-file-button";

describe("ViewFileButton", () => {
  it("links to the session-gated proxy route, never to storage directly", () => {
    render(<ViewFileButton documentId="doc-1" />);

    const link = screen.getByRole("link", { name: /view file/i });
    expect(link).toHaveAttribute("href", "/staff/api/yellow-card/documents/doc-1");
  });

  it("never puts a signed storage URL or a bearer token in the markup", () => {
    const { container } = render(<ViewFileButton documentId="doc-1" />);

    // The whole point of the proxy: the browser gets an id, not a credential.
    expect(container.innerHTML).not.toContain("supabase.co");
    expect(container.innerHTML).not.toContain("token=");
  });

  it("opens in a new tab without handing the document a window reference", () => {
    render(<ViewFileButton documentId="doc-1" />);

    const link = screen.getByRole("link", { name: /view file/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("accepts a custom label", () => {
    render(<ViewFileButton documentId="doc-1" label="Open ID photo" />);

    expect(screen.getByRole("link", { name: "Open ID photo" })).toBeInTheDocument();
  });
});
