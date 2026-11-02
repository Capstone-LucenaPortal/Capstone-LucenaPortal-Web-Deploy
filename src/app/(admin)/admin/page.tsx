"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/portals/admin/features/auth/hooks/use-auth";
import { EMPLOYEE_SIGN_IN_PATH } from "@/shared/guard/portals";

export default function Home() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.push(session ? "/admin/dashboard" : EMPLOYEE_SIGN_IN_PATH);
  }, [isLoading, session, router]);

  return null;
}
