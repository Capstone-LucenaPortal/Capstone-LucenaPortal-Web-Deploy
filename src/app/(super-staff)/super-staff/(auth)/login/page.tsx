import { LoginForm } from "@/portals/super-staff/features/auth/components/login-form";
import { IDLE_SIGNOUT_REASON } from "@/portals/super-staff/lib/supabase/idle-timeout";

// A Super Staff employee who is already signed in never reaches this page: the
// request guard sends them on to the accounts pool (src/shared/guard/portals.ts,
// signedInLoginRedirect). Any other signed-in account is shown the form with
// its session kept — sent on in, it would only land on forbidden (issue #19).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  // Set by the idle timeout
  // (src/portals/super-staff/components/layout/idle-timeout.tsx), so the
  // operator learns why they are suddenly looking at the sign-in form.
  const { reason } = await searchParams;
  return <LoginForm idleSignOut={reason === IDLE_SIGNOUT_REASON} />;
}
