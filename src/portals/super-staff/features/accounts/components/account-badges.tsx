import { Badge } from "@/portals/super-staff/components/ui/badge";
import type { AccountStatus, Role } from "../types";

export function RoleBadge({ role }: { role: Role }) {
  const variant =
    role === "Admin" || role === "Super Staff" ? "info" : "default";
  return <Badge variant={variant}>{role}</Badge>;
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge variant={status === "Active" ? "success" : "default"}>{status}</Badge>
  );
}

export function SupervisorBadge() {
  return <Badge variant="info">✓</Badge>;
}
