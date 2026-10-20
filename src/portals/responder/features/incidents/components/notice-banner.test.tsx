import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoticeBanner } from "@/portals/responder/features/incidents/components/notice-banner";
import { NOTICES } from "@/portals/responder/features/incidents/lib/notice";

describe("NoticeBanner", () => {
  it("says the sentence for a known code", () => {
    render(<NoticeBanner code="gone" />);

    expect(screen.getByText(NOTICES.gone)).toBeInTheDocument();
  });

  it("NAMES the ticket standing in the way of a claim", () => {
    // Issue #8, criterion 2 of #4: a refused claim has to say WHICH ticket is
    // already held, not just that one is.
    render(<NoticeBanner code="blocked" heldRef="INC-2026-000106" />);

    expect(
      screen.getByText(
        "You are already holding INC-2026-000106. Finish or hand it back before claiming another.",
      ),
    ).toBeInTheDocument();
  });

  it("renders NOTHING for blocked when there is no reference to name", () => {
    // Issue #9. The empty state renders this banner too, so a hold released
    // between the refusal and the render arrives with nothing to name -- and
    // "you are already holding a ticket" is then an accusation the rest of that
    // screen denies. Silence, not a vaguer sentence, and never a raw `{ref}`.
    const { container } = render(<NoticeBanner code="blocked" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("explains a force-release in words a responder can act on", () => {
    // The case that drove decision E3: a supervisor can take the ticket while
    // it is being worked, and the next tap must not be a blank error page.
    render(<NoticeBanner code="force_released" />);

    expect(
      screen.getByText(
        "A supervisor returned this ticket to the pool. It is back with your department.",
      ),
    ).toBeInTheDocument();
  });

  it("renders NOTHING for an unknown code — not an empty box", () => {
    // noticeFor already re-throws anything unmapped, so a code reaching here
    // that we do not know came from a hand-edited URL, which deserves silence
    // rather than a scary banner.
    const { container } = render(<NoticeBanner code="not_a_real_code" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no code at all", () => {
    const { container } = render(<NoticeBanner code={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is announced to a screen reader without stealing focus", () => {
    render(<NoticeBanner code="gone" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
