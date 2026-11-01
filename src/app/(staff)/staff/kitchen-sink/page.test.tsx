import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import KitchenSinkPage from "./page";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));

vi.mock("next/navigation", () => ({ notFound }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("Staff Kitchen Sink page", () => {
  it("is not found in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => render(<KitchenSinkPage />)).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the component gallery outside production", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<KitchenSinkPage />);

    expect(screen.getByRole("heading", { name: "Kitchen Sink" })).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});
