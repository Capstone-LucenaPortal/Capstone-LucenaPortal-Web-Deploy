/**
 * The address of the Yellow Card form's Correction mode (ADR 0011, ticket #171).
 * The Digital Card links here and `/yellow-card` reads it, so the two share it.
 * No backend import, so the card can link here without pulling in the service.
 */
const MODE_PARAM = 'mode';
const CORRECTION_MODE = 'correction';

export const CORRECTION_HREF = `/yellow-card?${MODE_PARAM}=${CORRECTION_MODE}`;

export function isCorrectionMode(params: Pick<URLSearchParams, 'get'> | null): boolean {
  return params?.get(MODE_PARAM) === CORRECTION_MODE;
}
