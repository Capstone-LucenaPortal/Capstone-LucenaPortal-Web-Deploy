// @vitest-environment node
//
// src/app/(admin)/admin/(shell)/yellow-card/page.test.tsx
//
// The page reads SLA Reports' filter from the address with useSearchParams
// (#127). While a production build prerenders a page, that hook throws, and
// React renders the nearest Suspense boundary's fallback in its place. The
// page used to wrap itself whole, with an empty fallback, so its server HTML
// held none of the page (#133). The Admin shell's auth gate is left out: this
// renders the route's page alone.
import { renderToString } from "react-dom/server";
import { vi } from "vitest";
import Page from "@/app/(admin)/admin/(shell)/yellow-card/page";

vi.mock("next/navigation", () => ({
  // What Next's useSearchParams does on the server during a prerender.
  useSearchParams: () => {
    throw new Error("Bailout to client rendering: useSearchParams()");
  },
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("/admin/yellow-card prerendered", () => {
  it("carries the page's hero and loading skeletons, not an empty fallback", () => {
    const html = renderToString(<Page />);

    expect(html).toContain(">Yellow Card</h1>");
    expect(html).toContain("Loading applications…");
    // The skeletons are aria-hidden, so their class is all they show.
    expect(html).toContain("animate-pulse");
  });
});
