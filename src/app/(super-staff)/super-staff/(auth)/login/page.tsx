import { redirect } from "next/navigation";
import { LoginForm } from "@/portals/super-staff/features/auth/components/login-form";
import { IDLE_SIGNOUT_REASON } from "@/portals/super-staff/lib/supabase/idle-timeout";
import { createClient } from "@/shared/supabase/server";

// Login is exempt from the request guard's role check (it has to be, or
// signing in redirects to itself forever), so nothing else stops an
// already-signed-in employee from landing back on the sign-in form — a
// bookmark, the browser's address bar, a stale tab. Bounce them to the
// accounts pool instead.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const supabase = await createClient();

  // getUser() validates the JWT against the auth server; getSession() would
  // trust whatever is in the cookie. Same rule as src/shared/guard/proxy.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/super-staff/accounts");
  }

  // Set by the idle timeout
  // (src/portals/super-staff/components/layout/idle-timeout.tsx), so the
  // operator learns why they are suddenly looking at the sign-in form.
  const { reason } = await searchParams;
  return <LoginForm idleSignOut={reason === IDLE_SIGNOUT_REASON} />;
}
