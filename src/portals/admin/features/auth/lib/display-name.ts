// The admin's name as the shell shows it: the Sidebar's "Welcome back" and the
// Dashboard's greeting. Both get it from the server's read of my_staff_profile
// (see ./profile.ts), so it is in the first HTML.

type NamedProfile = { full_name: string | null; email: string | null };

export function adminDisplayName(profile: NamedProfile | null): string {
  if (profile?.full_name) return profile.full_name;
  if (profile?.email) return profile.email.split("@")[0];
  return "";
}
