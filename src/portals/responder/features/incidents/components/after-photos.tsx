import Link from "next/link";
import { Camera } from "lucide-react";
import {
  PhotoGrid,
  type GridPhoto,
} from "@/portals/responder/features/incidents/components/photo-grid";
import { cn } from "@/portals/responder/lib/utils";

/**
 * The evidence PRD §4.4 demands, and the gate it guards.
 *
 * The header states the requirement before the footer enforces it, which is
 * what lets Resolve stay pressable: by the time the sheet opens, the reason has
 * already been on screen. The real gate is `resolve_incident`'s
 * confirmed-after-photo check — this is the courtesy in front of it.
 *
 * ⚠️ THERE IS NO REMOVE BUTTON, AND THAT IS NOT AN OVERSIGHT.
 * Story 36 ("remove an after photo I attached by mistake") CANNOT be satisfied:
 * `storage.objects` carries only SELECT and INSERT policies — no bucket exposes
 * DELETE to any role, and `sweep_stale_reservations()` does not exist. Verified
 * against the Sandbox on 2026-08-12. A remove button would 403, so the
 * affordance is removed rather than left to fail. Restoring it needs a delete
 * path in the DB repo (an l57 follow-up), not a workaround here.
 */
export function AfterPhotos({
  photos,
  maxPhotos,
  incidentId,
}: {
  /** Already signed by the page — Seam 2 keeps the fetching out of here. */
  photos: GridPhoto[];
  /** From public_incident_config.max_photos_per_cycle — 3, not 6. */
  maxPhotos: number;
  incidentId: string;
}) {
  const ready = photos.length > 0;

  return (
    <section className="border-b border-gray-200 bg-white px-4 py-3.75">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[11px] font-bold tracking-[0.07em] uppercase text-gray-500">
          After photo · required to resolve
        </h2>
        <span
          className={cn(
            "text-[11px] font-semibold",
            ready ? "text-green-800" : "text-amber-700",
          )}
        >
          {ready ? "Ready to resolve" : "Photo required"}
        </span>
      </div>

      {/* The picture itself, not a filename: the responder is looking at what
          the citizen will be shown, and a tile that only says "IMG_2470.jpg"
          cannot tell them whether they photographed the right thing. */}
      <PhotoGrid photos={photos} alt="After photo">
        {photos.length < maxPhotos && (
          <Link
            href={`/responder/my-ticket?sheet=photo&incidentId=${incidentId}`}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.25 rounded-md border-[1.5px] border-dashed text-[10.5px] font-semibold",
              ready
                ? "border-gray-300 bg-gray-50 text-gray-500"
                : "border-red-600 bg-red-50 text-red-800",
            )}
          >
            <Camera size={22} aria-hidden />
            Add photo
          </Link>
        )}
      </PhotoGrid>

      {/* Story 34: the responder is told the number and stopped at it, rather
          than losing an upload to a limit they did not know about. */}
      <p className="mt-2 text-[11px] text-gray-500">
        {photos.length} of {maxPhotos} attached this cycle.
      </p>
    </section>
  );
}
