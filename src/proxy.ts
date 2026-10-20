import { type NextRequest } from "next/server";

import { guardRequest } from "@/shared/guard/proxy";

export async function proxy(request: NextRequest) {
  return await guardRequest(request);
}

export const config = {
  matcher: [
    /*
     * The staff-side Portals that have a row in the guard's table
     * (src/shared/guard/portals.ts): /admin, /staff, /super-staff,
     * /responder and everything under them, except static files. Every other
     * path — the Citizen Portal — passes through untouched; the guard would
     * pass it through anyway, this just skips the call.
     *
     * The extension list must cover every static type, not just images — a
     * match here costs a full getUser() + DB read + redirect cycle before
     * answering a font, stylesheet, or robots.txt request.
     *
     * Login, accept-invite and forbidden are NOT excluded here: the guard's
     * decision handles them (src/shared/guard/decide.ts), so the rules live in
     * one place.
     */
    "/((?:admin|staff|super-staff|responder)(?:/(?!.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|webmanifest|woff|woff2|ttf|otf)$).*)?)",
  ],
};
