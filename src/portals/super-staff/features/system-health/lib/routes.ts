import { sectionInfo, type SectionKey } from "./status";

export const SYSTEM_HEALTH_HREF = "/super-staff/system-health";

/** A section's page: one route per section, under General, at its slug. */
export function sectionHref(key: SectionKey): string {
  return `${SYSTEM_HEALTH_HREF}/${sectionInfo(key).slug}`;
}

const SUPABASE_DASHBOARD = "https://supabase.com/dashboard";

/**
 * The project's Logs Explorer, from the project ref in the Supabase URL
 * (https://<ref>.supabase.co). A URL without one, such as a local stack,
 * links to the dashboard instead.
 */
export function supabaseLogsHref(supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  try {
    const host = new URL(supabaseUrl ?? "").hostname;
    if (host.endsWith(".supabase.co")) {
      return `${SUPABASE_DASHBOARD}/project/${host.split(".")[0]}/logs/explorer`;
    }
  } catch {
    // Not a URL: fall through to the dashboard.
  }
  return SUPABASE_DASHBOARD;
}
