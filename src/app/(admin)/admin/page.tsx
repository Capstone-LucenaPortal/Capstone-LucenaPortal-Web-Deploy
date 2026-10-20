"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/portals/admin/features/auth/hooks/use-auth";

export default function Home() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.push(session ? "/admin/dashboard" : "/admin/login");
  }, [isLoading, session, router]);

  return null;
}
