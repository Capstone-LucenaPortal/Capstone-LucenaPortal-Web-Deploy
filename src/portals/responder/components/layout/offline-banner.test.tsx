import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { OfflineBanner } from "./offline-banner";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

function goOnline(online: boolean) {
  setOnline(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("OfflineBanner", () => {
  it("shows nothing while connected", () => {
    setOnline(true);
    render(<OfflineBanner />);

    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });

  it("says so when the page opens without a connection", () => {
    setOnline(false);
    render(<OfflineBanner />);

    expect(screen.getByRole("status")).toHaveTextContent(/you are offline/i);
  });

  it("appears when the connection drops and says taps are held", () => {
    setOnline(true);
    render(<OfflineBanner />);

    goOnline(false);

    expect(screen.getByRole("status")).toHaveTextContent(/you are offline/i);
    expect(screen.getByRole("status")).toHaveTextContent(/nothing you tap will be sent/i);
  });

  // The pool and the held ticket were rendered before the drop; another
  // responder may have claimed or resolved since.
  it("reloads the page's data when the connection comes back", () => {
    setOnline(false);
    render(<OfflineBanner />);

    goOnline(true);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument();
  });

  // Offline, a failed RSC fetch makes Next fall back to a full browser
  // navigation -- which lands on the browser's own "no internet" page, the
  // blank screen ISO-9 is about. Held, the responder keeps the page they had.
  it("holds a link tap while offline", () => {
    setOnline(false);
    render(
      <>
        <OfflineBanner />
        <a href="/responder/pool">Pool</a>
      </>,
    );

    const followed = fireEvent.click(screen.getByRole("link", { name: "Pool" }));

    expect(followed).toBe(false);
  });

  // React skips a form action whose submit was prevented, so nothing is sent
  // and the note or reason typed into the form is still there.
  it("holds a form submit while offline", () => {
    setOnline(false);
    render(
      <>
        <OfflineBanner />
        <form aria-label="note">
          <button type="submit">Post</button>
        </form>
      </>,
    );

    const sent = fireEvent.submit(screen.getByRole("form", { name: "note" }));

    expect(sent).toBe(false);
  });

  it("lets links and forms through while connected", () => {
    setOnline(true);
    let heldBeforeUs: boolean | undefined;
    render(
      <>
        <OfflineBanner />
        <a href="#pool">Pool</a>
        <form
          aria-label="note"
          onSubmit={(e) => {
            heldBeforeUs = e.defaultPrevented;
            e.preventDefault();
          }}
        />
      </>,
    );

    expect(fireEvent.click(screen.getByRole("link", { name: "Pool" }))).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "note" }));
    expect(heldBeforeUs).toBe(false);
  });

  // A phone call to the citizen needs signal, not data.
  it("lets a tel: link through while offline", () => {
    setOnline(false);
    render(
      <>
        <OfflineBanner />
        <a href="tel:+639171234567">Call</a>
      </>,
    );

    expect(fireEvent.click(screen.getByRole("link", { name: "Call" }))).toBe(true);
  });

  it("lets an in-page link through while offline", () => {
    setOnline(false);
    render(
      <>
        <OfflineBanner />
        <a href="#details">Details</a>
      </>,
    );

    expect(fireEvent.click(screen.getByRole("link", { name: "Details" }))).toBe(true);
  });

  it("stops holding taps once it unmounts", () => {
    setOnline(false);
    const { unmount } = render(<OfflineBanner />);
    unmount();
    render(<a href="#pool">Pool</a>);

    expect(fireEvent.click(screen.getByRole("link", { name: "Pool" }))).toBe(true);
  });

  it("does not reload on mount while already connected", () => {
    setOnline(true);
    render(<OfflineBanner />);

    expect(refresh).not.toHaveBeenCalled();
  });
});
