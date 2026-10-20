import type { ContactMessage, ContactStatus } from "../types";

export const CONTACT_STATUSES: ContactStatus[] = ["new", "read", "archived"];

const LABELS: Record<ContactStatus, string> = {
  new: "New",
  read: "Read",
  archived: "Archived",
};

export function statusLabel(status: ContactStatus): string {
  return LABELS[status] ?? String(status);
}

export function countUnread(messages: ContactMessage[]): number {
  return messages.filter((m) => m.status === "new").length;
}
