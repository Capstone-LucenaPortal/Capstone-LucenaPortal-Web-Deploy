"use client";

import type { AuthError, Session } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { createClient } from "@/shared/supabase/client";
import { isActiveAdmin } from "@/portals/admin/lib/supabase/access";
import type { Database } from "@/shared/supabase/types";

type StaffProfile = Database["public"]["Views"]["my_staff_profile"]["Row"];

interface AuthContextValue {
  session: Session | null;
  profile: StaffProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isDeactivated: boolean;
  // The AuthError itself, not its message: the login page maps it to a fixed
  // string (signInErrorMessage) and needs its type to tell offline from a
  // wrong password.
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    // Tracks the signed-in user id across auth events so onAuthStateChange
    // can tell a genuine sign-in/sign-out/user-change (which must blank the
    // UI while the new profile loads) apart from a same-user event such as
    // TOKEN_REFRESHED (which must not: Supabase emits those roughly hourly
    // and on tab focus, and re-raising isLoading unmounts the whole admin
    // subtree — including any open PII review modal, which then re-fires its
    // audited read on remount).
    let currentUserId: string | null = null;

    // Reading the profile is what turns "signed in" into "signed in as an
    // admin". The role is checked against the table on every load rather than
    // read from the JWT, because a token stays valid for up to an hour after
    // an account is deactivated. This still runs on every auth event
    // (including same-user ones) below — only the loading flash is skipped.
    async function loadProfile(next: Session | null) {
      if (!next) {
        if (active) {
          setProfile(null);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase.from("my_staff_profile").select("*").maybeSingle();

      // No row is not an error. A citizen, or any user without a staff account,
      // legitimately returns zero rows — that is the view's gate doing its job.
      if (active) {
        setProfile(data ?? null);
        setIsLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      currentUserId = data.session?.user.id ?? null;
      setSession(data.session);
      void loadProfile(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      const nextUserId = next?.user.id ?? null;
      const userChanged = nextUserId !== currentUserId;
      currentUserId = nextUserId;
      setSession(next);
      // Only a genuine sign-in/sign-out/user-change blanks the UI. A
      // same-user event (TOKEN_REFRESHED, USER_UPDATED, tab-focus refresh)
      // still re-reads the profile above, it just does so without dropping
      // isLoading back to true first.
      if (userChanged) {
        setIsLoading(true);
      }
      void loadProfile(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    // supabase-js keeps the local session alive when the revoke call fails,
    // so the cookie is still live server-side. Only clear local state on
    // success — clearing it on failure would show a logged-out-looking UI
    // over a session that is, in fact, still valid.
    if (error) {
      return { error: error.message };
    }
    setSession(null);
    setProfile(null);
    return { error: null };
  }

  // The same rule the shared request guard applies (src/shared/guard/decide.ts),
  // so "admin" means exactly one thing on both sides of the wire.
  const isAdmin = isActiveAdmin(profile);
  const isDeactivated = profile?.status === "inactive";

  return (
    <AuthContext.Provider
      value={{ session, profile, isLoading, isAdmin, isDeactivated, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
