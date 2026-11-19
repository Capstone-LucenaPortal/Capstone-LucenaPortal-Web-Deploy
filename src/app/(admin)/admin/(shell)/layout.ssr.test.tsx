// @vitest-environment node
//
// src/app/(admin)/admin/(shell)/layout.ssr.test.tsx
//
// Issue #150: what the server sends a signed-in active admin. The shell
// layout and the pages are rendered to HTML the way the server renders them,
// inside the real AuthProvider, whose first state is "still loading, no
// session": its effects never run on the server. The shell used to wait on
// that state and send an empty body.
import { renderToString } from "react-dom/server";
import { vi } from "vitest";
import AdminShellLayout from "@/app/(admin)/admin/(shell)/layout";
import DashboardRoute from "@/app/(admin)/admin/(shell)/dashboard/page";
import IssueReportsRoute from "@/app/(admin)/admin/(shell)/issue-reports/page";
import YellowCardRoute from "@/app/(admin)/admin/(shell)/yellow-card/page";
import { AuthProvider } from "@/portals/admin/features/auth/hooks/use-auth";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/yellow-card",
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  },
}));

vi.mock("@/portals/admin/features/auth/lib/profile", () => ({
  getAdminProfile: async () => ({
    id: "11111111-1111-1111-1111-111111111111",
    full_name: "Maria Santos",
    email: "maria.santos@lucenacity.gov.ph",
    role: "admin",
    status: "active",
  }),
  hasSession: async () => true,
}));

async function serverHtml(page: React.ReactNode) {
  return renderToString(<AuthProvider>{await AdminShellLayout({ children: page })}</AuthProvider>);
}

describe("an Admin page's server HTML, for an active admin", () => {
  it("carries the shell: skip link, Sidebar nav and welcome, and <main id=\"main\">", async () => {
    const html = await serverHtml(<YellowCardRoute />);

    expect(html).toContain('href="#main"');
    expect(html).toContain("Skip to content");
    expect(html).toMatch(/<main id="main" tabindex="-1"/i);
    expect(html).toContain('href="/admin/issue-reports"');
    expect(html).toContain("Welcome back, <!-- -->Maria Santos");
  });

  it("carries the Yellow Card page's hero and skeletons", async () => {
    const html = await serverHtml(<YellowCardRoute />);

    expect(html).toContain(">Yellow Card</h1>");
    expect(html).toContain("Loading applications…");
    expect(html).toContain("animate-pulse");
  });

  it("carries the Incident Reports page's hero and skeletons", async () => {
    const html = await serverHtml(<IssueReportsRoute />);

    expect(html).toMatch(/<main id="main"/);
    expect(html).toMatch(/<h1[^>]*>[^<]*Incident/);
    expect(html).toContain("Loading reports…");
    expect(html).toContain("animate-pulse");
  });

  it("carries the Dashboard's greeting by name", async () => {
    const html = await serverHtml(await DashboardRoute());

    expect(html).toContain("Maria Santos · leadership view");
  });
});
