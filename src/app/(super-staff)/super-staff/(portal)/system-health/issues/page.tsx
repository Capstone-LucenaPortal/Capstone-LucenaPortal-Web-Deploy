import { SystemIssuesView } from "@/portals/super-staff/features/system-issues/components/system-issues-view";

/**
 * System issues (ADR 0013), under System Health: a static route, so it wins
 * over the [section] slugs, none of which is "issues".
 */
export default function SystemIssuesPage() {
  return <SystemIssuesView />;
}
