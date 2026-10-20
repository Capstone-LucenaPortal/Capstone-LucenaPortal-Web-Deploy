export function getOrganizer(booking: {
  organization_name: string | null;
  contact_person: string;
}): string {
  // An individual booking a rehearsal slot has no organisation; the contact
  // person IS the organiser. Empty-string organisation names are treated as
  // absent because submit_booking nullifies blanks, but a direct insert can
  // still produce one.
  return booking.organization_name?.trim() || booking.contact_person;
}
