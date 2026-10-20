import { ImageOff } from "lucide-react";

/**
 * Signed photo URLs as a grid. PROPS, NOT FETCHING — Seam 2: the page resolves
 * the URLs and hands the pairs down, so this stays a test of rendering.
 *
 * ⚠️ A null url is a MISSING TILE, not a crash and not an omitted row.
 * `getPhotoUrl` returns null rather than throwing when entitlement fails or the
 * object has gone, because an unreadable photo should not take down the report
 * pane around it. Dropping the tile entirely would silently change the count
 * the header just stated.
 *
 * Plain <img>, not next/image: these are short-lived signed URLs on a Supabase
 * host, so the optimiser would need remotePatterns for a URL that expires in
 * sixty seconds and cannot be cached anyway.
 */
export interface GridPhoto {
  id: string;
  url: string | null;
}

export function PhotoGrid({
  photos,
  alt,
  children,
}: {
  photos: GridPhoto[];
  /** Singular subject — "Citizen photo", "After photo". Numbered per tile. */
  alt: string;
  /**
   * Trailing tiles, such as an add slot. They go INSIDE this grid so they sit
   * beside the photos. A second grid wrapped them onto a new row (SCRUM-191).
   */
  children?: React.ReactNode;
}) {
  if (photos.length === 0 && !children) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, index) =>
        photo.url ? (
          <img
            key={photo.id}
            src={photo.url}
            alt={`${alt} ${index + 1} of ${photos.length}`}
            className="aspect-square w-full rounded-md border border-gray-200 object-cover"
          />
        ) : (
          <div
            key={photo.id}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 bg-gray-50 text-gray-500"
          >
            <ImageOff size={22} strokeWidth={1.8} aria-hidden />
            <span className="text-[10px] font-semibold">Unavailable</span>
          </div>
        ),
      )}
      {children}
    </div>
  );
}
