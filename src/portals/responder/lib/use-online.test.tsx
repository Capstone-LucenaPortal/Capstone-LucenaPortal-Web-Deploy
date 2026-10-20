import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useOnlinePush } from "./use-online";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

function Go() {
  const pushOnline = useOnlinePush();
  return <button onClick={() => pushOnline("/responder/my-ticket")}>Go</button>;
}

afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
});

describe("useOnlinePush", () => {
  it("navigates while connected", () => {
    setOnline(true);
    render(<Go />);

    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(push).toHaveBeenCalledWith("/responder/my-ticket");
  });

  // router.push offline fails its RSC fetch and Next falls back to a full
  // page load (issue #7). Held, the page the responder has stays.
  it("holds the navigation while offline", () => {
    setOnline(false);
    render(<Go />);

    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(push).not.toHaveBeenCalled();
  });
});
