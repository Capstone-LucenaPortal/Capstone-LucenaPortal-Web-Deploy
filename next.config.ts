import type { NextConfig } from "next";

import { securityHeaders } from "./src/portals/admin/lib/security-headers";
import { securityHeaderRoutes as staffSecurityHeaderRoutes } from "./src/portals/staff/lib/security-headers";
import { securityHeaders as superStaffSecurityHeaders } from "./src/portals/super-staff/lib/security-headers";
import { securityHeaders as responderSecurityHeaders } from "./src/portals/responder/lib/security-headers";
import { securityHeaderRoutes as citizenSecurityHeaderRoutes } from "./src/portals/citizen/lib/security-headers";

const nextConfig: NextConfig = {
  // Do not advertise the framework and version to every client.
  poweredByHeader: false,
  experimental: {
    // The app has one root layout per Portal, so an unmatched URL has no
    // single layout to render a 404 inside. src/app/global-not-found.tsx
    // serves the Citizen Portal's, as the citizen app at the root did.
    globalNotFound: true,
  },
  async headers() {
    return [
      {
        // Every Admin route, including /admin/login. Scoped to /admin so
        // each Portal keeps its own headers and CSP. See
        // src/portals/admin/lib/security-headers.ts for what each header does
        // and why.
        source: "/admin/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV !== "production",
        }),
      },
      // Every Staff route, including /staff/login and the document routes
      // under /staff/api, which keep their own sandboxed CSP. See
      // src/portals/staff/lib/security-headers.ts.
      ...staffSecurityHeaderRoutes({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        dev: process.env.NODE_ENV !== "production",
      }),
      {
        // Every Super-staff route, including /super-staff/login. See
        // src/portals/super-staff/lib/security-headers.ts.
        source: "/super-staff/:path*",
        headers: superStaffSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV !== "production",
        }),
      },
      {
        // Every Responder route, including /responder/login and its web app
        // manifest. See src/portals/responder/lib/security-headers.ts.
        source: "/responder/:path*",
        headers: responderSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV !== "production",
        }),
      },
      // Every other path: the Citizen Portal at the root, its manifest and
      // sitemap. Its CSP allows the weather API and the map and social-feed
      // frames, and is sent in production builds only. See
      // src/portals/citizen/lib/security-headers.ts.
      ...citizenSecurityHeaderRoutes({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        dev: process.env.NODE_ENV !== "production",
      }),
    ];
  },
};

export default nextConfig;
