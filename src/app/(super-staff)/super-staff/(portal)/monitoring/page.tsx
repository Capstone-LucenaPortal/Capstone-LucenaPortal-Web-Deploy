import { redirect } from "next/navigation";

export default function MonitoringPage() {
  // Monitoring became System Health (#72). Old links and bookmarks land on
  // the new page instead of the 404.
  redirect("/super-staff/system-health");
}
