import { Badge } from "@/portals/staff/components/ui/badge";
import type { RateTier } from "../types";

/**
 * The rate tier and whether anyone has substantiated it, as one badge.
 *
 * Conflating the two is the bug this exists to prevent. A discounted booking
 * whose organisation document nobody has seen is charged half price on a claim
 * the city has not checked — fourteen of the twenty-one sandbox bookings are in
 * exactly that state, and `tier_verified` is true on none of them. Rendering a
 * plain "Discounted" for both states is what makes an unsubstantiated
 * half-price booking look settled.
 *
 * `verified` is deliberately ignored on the commercial tier: review_booking can
 * leave tier_verified true on a row it has just repriced to commercial, and
 * "Commercial · verified" would suggest a discount had been substantiated when
 * the opposite happened.
 */
export function RateTierBadge({
  tier,
  verified,
}: {
  tier: RateTier;
  verified: boolean;
}) {
  if (tier === "commercial") {
    return <Badge variant="default">Commercial</Badge>;
  }

  return verified ? (
    <Badge variant="success">Discounted · verified</Badge>
  ) : (
    <Badge variant="warning">Discounted · unverified</Badge>
  );
}
