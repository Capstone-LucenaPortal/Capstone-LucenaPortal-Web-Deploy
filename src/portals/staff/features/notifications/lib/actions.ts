"use server";

/**
 * The Notifications module's one server action: a shell around ./open.ts that
 * supplies the real client and owns revalidation and the redirect.
 *
 * Revalidation is framework glue and is deliberately untested.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { openNotification } from "./open";

/** Posted by a notice's row: marks it read and opens what it is about. */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const destination = await openNotification(
    await createClient(),
    String(formData.get("notificationId") ?? ""),
  );

  // The layout, so the bell's count drops on whichever page comes next.
  revalidatePath("/staff", "layout");
  redirect(destination);
}
