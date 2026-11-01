import { SystemHealthShell } from "@/portals/super-staff/features/system-health/components/system-health-shell";

export default function SystemHealthLayout({ children }: { children: React.ReactNode }) {
  return <SystemHealthShell>{children}</SystemHealthShell>;
}
