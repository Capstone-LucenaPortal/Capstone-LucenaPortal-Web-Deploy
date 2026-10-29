// src/app/(admin)/admin/login/page.tsx
"use client";

import { SubmitEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/portals/admin/features/auth/hooks/use-auth";
import { ROLE_ARTICLE, ROLE_LABEL } from "@/portals/admin/features/auth/lib/role-labels";
import { Button } from "@/portals/admin/components/ui/button";
import { PORTAL_PREFIX } from "@/shared/guard/portals";
import { signInErrorMessage } from "@/shared/supabase/sign-in-error";

export default function LoginPage() {
  const { signIn, profile, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Guards against double submits: a second click mid-flight would fire a
  // second signInWithPassword round-trip against Supabase Auth's rate limits.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only an admin account is sent on to the dashboard (a deactivated one is
  // told so there). Every Portal shares one session, so another Portal's
  // account (or a citizen's) sent on in would land on the refusal screen; it is
  // shown the form instead, its session kept (issue #19).
  const isAdminAccount = profile?.role === "admin";
  // That other account is named on the form, with a link back to its Portal.
  const signedInAs = isAdminAccount ? null : (profile?.role ?? null);

  useEffect(() => {
    if (!isLoading && isAdminAccount) {
      router.push("/admin/dashboard");
    }
  }, [isLoading, isAdminAccount, router]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: signInError } = await signIn(email.trim().toLowerCase(), password);
      if (!signInError) {
        router.push("/admin/dashboard");
      } else {
        // Never Supabase's raw message: see signInErrorMessage.
        setError(signInErrorMessage(signInError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || isAdminAccount) {
    return null;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <Image
        src="/perez-park.webp"
        alt=""
        aria-hidden
        fill
        // This is the LCP element on the login page (the first screen most
        // users see), so it should start loading immediately.
        preload
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-blue-950/70 via-blue-950/35 to-blue-950/80"
      />

      <div className="login-card relative w-full max-w-sm overflow-hidden rounded-none bg-white shadow-2xl">
        <div className="flex items-center gap-4 bg-blue-900 px-6 py-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-none bg-white p-1">
            <img
              src="/lucena-seal.png"
              alt="Official seal of the City of Lucena"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-200">
              City Government of
            </p>
            <p className="text-xl font-bold leading-tight text-white">Lucena City</p>
            <p className="text-xs text-blue-100">Admin Portal</p>
          </div>
        </div>
        <div aria-hidden className="h-1 bg-yellow-500" />

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-sm text-gray-500">Please sign in to your account</p>
          </div>

          {signedInAs && (
            <p className="text-sm text-gray-600">
              {`You are signed in with ${ROLE_ARTICLE[signedInAs]} ${ROLE_LABEL[signedInAs]} account.`}{" "}
              <a href={PORTAL_PREFIX[signedInAs]} className="font-medium text-blue-900 underline">
                Go to the {ROLE_LABEL[signedInAs]} portal
              </a>
            </p>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
              className="w-full rounded-none border border-gray-300 px-3 py-2 text-sm focus:border-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="w-full rounded-none border border-gray-300 px-3 py-2 text-sm focus:border-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>

      <p className="absolute inset-x-0 bottom-4 text-center text-xs text-blue-100/70">
        Perez Park · Lucena City, Quezon Province
      </p>
    </main>
  );
}
