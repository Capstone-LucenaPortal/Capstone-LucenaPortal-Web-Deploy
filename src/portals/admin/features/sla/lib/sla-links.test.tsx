// src/portals/admin/features/sla/lib/sla-links.test.tsx
import { render, screen, within } from "@testing-library/react";
import { DateFilterBar, type DateFilterPreset } from "@/portals/admin/components/ui/date-filter-bar";
import { finishedLateHref, readSlaLink, YELLOW_CARD_PATH } from "@/portals/admin/features/sla/lib/sla-links";

const BASES = ["application", "completion"] as const;

function linkParams(href: string): URLSearchParams {
  return new URLSearchParams(href.slice(href.indexOf("?") + 1));
}

describe("readSlaLink", () => {
  // A preset the bar offers but a link can't carry would open the target
  // page on Month instead (#133).
  it("reads back every range the date filter bar offers", () => {
    const noop = () => {};
    render(
      <DateFilterBar
        basisOptions={[{ value: "application", label: "Application date" }]}
        dateBasis="application"
        onDateBasisChange={noop}
        preset="Month"
        onPresetChange={noop}
        customStart="2026-05-01"
        customEnd="2026-05-31"
        onCustomStartChange={noop}
        onCustomEndChange={noop}
        compare={false}
        onCompareChange={noop}
      />
    );
    const offered = within(screen.getByRole("group", { name: "Date range preset" }))
      .getAllByRole("button")
      .map((button) => button.textContent as DateFilterPreset);

    expect(offered).toEqual(["Today", "Week", "Month", "Quarter", "Annual"]);
    for (const preset of offered) {
      const href = finishedLateHref(YELLOW_CARD_PATH, preset, { from: "2026-05-01", to: "2026-05-31" }, "completion");
      expect(readSlaLink(linkParams(href), BASES)).toEqual({
        filter: "late",
        preset,
        from: null,
        to: null,
        basis: "completion",
      });
    }
  });

  it("ignores a range no preset is called", () => {
    const link = readSlaLink(new URLSearchParams("sla=late&range=Fortnight"), BASES);

    expect(link?.preset).toBeNull();
  });
});
