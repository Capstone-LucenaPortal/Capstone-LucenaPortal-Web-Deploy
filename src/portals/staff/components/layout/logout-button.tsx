"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/portals/staff/components/ui/button";
import { createClient } from "@/shared/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    setError(null);

    // Clear the session BEFORE navigating, and await it. Navigating first only
    // hides the portal behind /login — the auth cookie survives, so typing
    // /dashboard walks straight back in with no credentials. On a shared
    // workstation that hands the next person the previous operator's session.
    const { error: signOutError } = await createClient().auth.signOut();

    if (signOutError) {
      // supabase-js keeps the local session when the revoke call fails, so the
      // cookie is still live. Staying put with a visible error is the honest
      // outcome: bouncing to /login would show a sign-in form to someone who is
      // in fact still signed in, which is exactly the bug being fixed here.
      setError("Could not sign you out. Check your connection and try again.");
      setBusy(false);
      return;
    }

    // replace(), not push(): the portal page must not be one Back away.
    // refresh() drops the cached RSC render that still holds the profile.
    router.replace("/staff/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => void handleLogout()}
      >
        {busy ? "Signing out…" : "Logout"}
      </Button>
    </div>
  );
}
