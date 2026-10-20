"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon } from "lucide-react";
import {
  confirmAfterPhoto,
  requestAfterPhoto,
} from "@/portals/responder/features/incidents/actions";
import { useOnline, useOnlinePush } from "@/portals/responder/lib/use-online";
import { createClient } from "@/shared/supabase/client";

/**
 * THE ONLY NEW CLIENT COMPONENT IN THIS CUTOVER. It exists solely because bytes
 * cannot go through a server action.
 *
 * ⚠️ WHY NOT A SERVER ACTION: Server Action request bodies are capped at 1 MB by
 * default and a phone camera photo is 2–5 MB, so every upload would fail with a
 * generic action error rather than a size message. Raising the cap works but
 * pushes the bytes browser → portal server → storage, and a field worker on
 * mobile data should not pay that hop.
 *
 * ⚠️ THE BROWSER CANNOT WRITE ANYWHERE IT WAS NOT HANDED. The storage write gate
 * `can_write_incident_photo` admits only a path matching the caller's own
 * UNCONFIRMED reservation, so step 2 is safe without the server seeing the file.
 * l56c deliberately did not widen that gate — reads widened, writes did not.
 *
 * Three steps, and step 3 is the one that counts: confirm_upload is the audit
 * event, not the bytes.
 */

/**
 * ⚠️ request_incident_photo_upload REJECTS anything outside its list with
 * 22023. The `accept` attribute stays inside that list so a responder is
 * stopped by the picker rather than by a banner after choosing a file.
 *
 * NARROWER THAN THE RPC, deliberately: it also takes PDF, because one extension
 * list serves every upload RPC in l30. A PDF is not a photo, and the after photo
 * is what the citizen confirms the work against (SCRUM-191).
 */
const ACCEPTED = ".jpg,.jpeg,.png,image/jpeg,image/png";
const ACCEPTED_EXT = ["jpg", "jpeg", "png"];

export function AfterPhotoUploader({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  // A connection lost mid-upload holds the notice rather than turning it
  // into a full page load (issue #7); the offline banner says why.
  const push = useOnlinePush();
  const [busy, setBusy] = useState(false);
  const online = useOnline();

  async function upload(file: File) {
    setBusy(true);
    try {
      await steps(file);
    } catch {
      // A server action that cannot reach the server throws rather than
      // returning a notice (ISO-9). Story 35 still holds: say it failed.
      push("/responder/my-ticket?notice=upload_failed");
    } finally {
      setBusy(false);
    }
  }

  async function steps(file: File) {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();

    if (!ACCEPTED_EXT.includes(ext)) {
      return push("/responder/my-ticket?sheet=photo&notice=upload_failed");
    }

    // 1. Reserve.
    const reservation = await requestAfterPhoto(incidentId, ext);
    if (!reservation.ok) {
      return push(`/responder/my-ticket?notice=${reservation.notice}`);
    }

    // 2. PUT the bytes with the responder's OWN session, browser → storage.
    //    createClient() here is the BROWSER client, not the cookie-backed
    //    server one.
    const { error } = await createClient()
      .storage.from(reservation.bucket)
      .upload(reservation.path, file);

    // ⚠️ Story 35: an upload that fails partway must SAY it failed, so a
    //    responder does not resolve a ticket believing evidence was attached.
    //    The orphaned reservation stays unconfirmed and is therefore invisible
    //    to every count and every list — which is exactly what the
    //    `uploaded_at is not null` filters are for. Do not try to clean it up:
    //    no bucket exposes delete.
    if (error) {
      return push("/responder/my-ticket?notice=upload_failed");
    }

    // 3. Confirm. THIS is the attachment.
    const confirmed = await confirmAfterPhoto(
      reservation.rowId,
      file.size,
      file.type,
    );
    push(confirmed.ok ? "/responder/my-ticket" : "/responder/my-ticket?notice=upload_failed");
    router.refresh();
  }

  return (
    <div className="mt-4 flex gap-2.25">
      <Source
        label="Camera"
        capture
        busy={busy}
        offline={!online}
        onPick={upload}
        icon={<Camera size={26} aria-hidden />}
      />
      <Source
        label="Gallery"
        busy={busy}
        offline={!online}
        onPick={upload}
        icon={<ImageIcon size={26} aria-hidden />}
      />
    </div>
  );
}

function Source({
  label,
  capture = false,
  busy,
  offline,
  onPick,
  icon,
}: {
  label: string;
  capture?: boolean;
  busy: boolean;
  offline: boolean;
  onPick: (file: File) => void | Promise<void>;
  icon: React.ReactNode;
}) {
  return (
    <label
      className={`flex h-24 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white text-[13.5px] font-semibold text-gray-900 ${
        busy
          ? "cursor-wait opacity-50"
          : offline
            ? "cursor-not-allowed opacity-50"
            : ""
      }`}
    >
      <span className="text-lucena-blue">{icon}</span>
      {busy ? "Uploading…" : offline ? `${label} (offline)` : label}
      <input
        type="file"
        name="photo"
        accept={ACCEPTED}
        capture={capture ? "environment" : undefined}
        aria-label={label}
        disabled={busy || offline}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onPick(file);
        }}
      />
    </label>
  );
}
