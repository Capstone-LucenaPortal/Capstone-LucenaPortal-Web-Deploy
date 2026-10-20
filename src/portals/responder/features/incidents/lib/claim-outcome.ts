import type { ClaimResult } from "@/portals/responder/features/incidents/types";

/**
 * What the app does with each of claim_incident's five outcomes.
 *
 * The PRECEDENCE that used to live in resolveClaim -- already_yours before
 * blocked, lost distinct from gone -- is now inside the RPC, where it can be
 * true under concurrency, and is asserted by assert_l56_behaviour B8. What is
 * left here is routing, and it is still worth a test: five outcomes are five
 * different screens, and getting `lost` and `gone` the wrong way round shows a
 * responder a dialog naming a colleague who never claimed anything.
 *
 * The winner's NAME travels in the URL rather than an id, because the app has no
 * lawful way to resolve a responder id to a name -- deliberately. Putting the
 * assigned responder on responder_incidents would expose a standing roster of
 * every colleague's workload; the RPC hands the name over only in the moment you
 * lost to that person.
 */
export function routeForOutcome(result: ClaimResult): string {
  switch (result.outcome) {
    case "claimed":
    case "already_yours":
      // No toast on a win: landing on a ticket screen with your reference and a
      // running clock is unambiguous, and a toast would mean a client component
      // whose only job is to restate the page.
      return "/responder/my-ticket";

    case "blocked":
      return "/responder/my-ticket?notice=blocked";

    case "lost":
      return `/responder/pool?lost=${encodeURIComponent(result.winner_full_name ?? "")}`;

    case "gone":
      return "/responder/pool?notice=gone";

    default:
      // An outcome the database grew and this app has not been taught. Loud,
      // not silent -- the same rule notice.ts follows.
      throw new Error(`Unknown claim outcome: ${String(result.outcome)}`);
  }
}
