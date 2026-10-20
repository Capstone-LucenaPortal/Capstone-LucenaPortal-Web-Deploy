import { formatDateTime } from "@/portals/staff/lib/utils";
import type { IncidentPhoto } from "../types";

/**
 * The evidence, grouped by what it is evidence of.
 *
 * `before` is the citizen's photo — the thing that makes a report verified and
 * starts the SLA clock. `after` is the responder's, attached when they resolve.
 * Labelling them "Reported" and "Resolved" says which is which without the
 * reader having to know the enum.
 *
 * Every thumbnail is a small <img> inside a link to the full photo, and both go
 * through the proxy route rather than a signed URL — see that route's comment
 * for why. The route is same-origin, so the portal's `img-src 'self'` admits
 * it, and it serves only allowlisted image types inline.
 *
 * Plain <img>, not next/image: the optimiser fetches the photo itself, without
 * the officer's session, which the session gate turns away — and the route's
 * `no-store` means there is nothing for it to cache anyway.
 */
export function EvidenceStrip({
  photos,
  isVerified,
}: {
  photos: IncidentPhoto[];
  isVerified: boolean;
}) {
  if (photos.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {isVerified
          ? "This report was verified, but no photo is attached."
          : "No evidence photo yet — the report is unverified and the SLA clock has not started."}
      </p>
    );
  }

  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");

  return (
    <div className="space-y-6">
      {before.length > 0 && <Group title="Reported" photos={before} />}
      {after.length > 0 && <Group title="Resolved" photos={after} />}
    </div>
  );
}

function Group({ title, photos }: { title: string; photos: IncidentPhoto[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {title} ({photos.length})
      </p>
      <ul className="mt-2 flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <a
              href={`/staff/api/incidents/photos/${photo.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-32 rounded-md border border-gray-200 p-1.5 text-sm hover:border-lucena-blue hover:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
              <img
                src={`/staff/api/incidents/photos/${photo.id}`}
                alt={`${title} photo ${index + 1} of ${photos.length}`}
                loading="lazy"
                className="aspect-square w-full rounded bg-gray-100 object-cover"
              />
              <span className="mt-1 block truncate text-xs text-gray-500">
                {photo.uploaded_by_name} · {formatDateTime(photo.uploaded_at)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
