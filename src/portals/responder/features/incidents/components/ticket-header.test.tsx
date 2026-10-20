import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketHeader } from "@/portals/responder/features/incidents/components/ticket-header";
import { TicketActions } from "@/portals/responder/features/incidents/components/ticket-actions";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

vi.mock("@/portals/responder/features/incidents/actions", () => ({ resolveTicket: vi.fn() }));

const incident = anIncident();

describe("TicketHeader", () => {
  it("states the level, the progress, and the place", () => {
    render(<TicketHeader incident={incident} />);

    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Flooding")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Brgy. Ibabang Dupay · Quezon Ave. cor. Evangelista St.",
      ),
    ).toBeInTheDocument();
  });

  it("hands the free-text address to a map search", () => {
    render(<TicketHeader incident={incident} />);

    // PRD §4.3 — no coordinates are stored; the address goes to the phone's
    // map app as text.
    expect(screen.getByRole("link", { name: "Navigate" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Quezon%20Ave.%20cor.%20Evangelista%20St.%2C%20Ibabang%20Dupay%2C%20Lucena%20City",
    );
  });

  it("dials the reporter by name", () => {
    render(<TicketHeader incident={incident} />);

    expect(screen.getByRole("link", { name: "Call Maria" })).toHaveAttribute(
      "href",
      "tel:+639175550142",
    );
  });

  it("does not call an anonymous reporter by that name", () => {
    render(
      <TicketHeader
        incident={anIncident({
          reporter_first_name: "Anonymous",
          reporter_phone: "+63 917 555 0142",
        })}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Call the reporter" }),
    ).toBeInTheDocument();
  });

  it("shows a MISSING callback number as an absence, not a dead link", () => {
    // C5 and story 12. l32 nulls the number on an anonymous report as a
    // security fix, so a `tel:` link would dial nothing and read as a broken
    // app. The absence must be shown as an absence.
    render(
      <TicketHeader
        incident={anIncident({
          reporter_first_name: "Anonymous",
          reporter_phone: null,
        })}
      />,
    );

    expect(screen.getByText("No callback number")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Call/ }),
    ).not.toBeInTheDocument();
    // Navigate is unaffected — only the phone is masked.
    expect(screen.getByRole("link", { name: "Navigate" })).toBeInTheDocument();
  });
});

describe("TicketActions", () => {
  it("names what the gate wants and stays pressable anyway", () => {
    render(<TicketActions incidentId="inc-1" ready={false} />);

    const resolve = screen.getByRole("button", {
      name: "Resolve · needs an after photo",
    });

    // Pressing it opens the Add-photo sheet: the gate holds, and in the same
    // tap it hands over the fix.
    expect(resolve).toBeEnabled();
  });

  it("relabels once the evidence is in", () => {
    render(<TicketActions incidentId="inc-1" ready />);

    expect(
      screen.getByRole("button", { name: "Resolve this incident" }),
    ).toBeEnabled();
  });

  it("carries the incident id the RPC needs", () => {
    // The old actions read the held ticket from the cookie; these take an id,
    // because resolve_incident does.
    const { container } = render(
      <TicketActions incidentId="inc-42" ready={false} />,
    );

    expect(
      container.querySelector('input[name="incidentId"]'),
    ).toHaveValue("inc-42");
  });

  it("offers both escape hatches", () => {
    render(<TicketActions incidentId="inc-1" ready={false} />);

    expect(
      screen.getByRole("link", { name: "Release to pool" }),
    ).toHaveAttribute("href", "/responder/my-ticket?sheet=release");
    expect(
      screen.getByRole("link", { name: "Wrong department" }),
    ).toHaveAttribute("href", "/responder/my-ticket?sheet=reject");
  });
});
