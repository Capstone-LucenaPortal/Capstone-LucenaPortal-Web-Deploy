// Domain types for the auth feature.
import type { Database } from "@/shared/supabase/types";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

/** A row of my_staff_profile, narrowed to what admission needs. */
export type StaffProfile = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  /** 'active' | 'inactive'. Typed as string because the view column is text. */
  status: string;
};
