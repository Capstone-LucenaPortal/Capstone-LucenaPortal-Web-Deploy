// Mirrors `super_events` / `platform_city_events`. Unlike posts, `is_published`
// is a real editable column here — there is no derived status.
export type CityEvent = {
  id: string;
  title: string;
  description: string | null;
  categoryCode: string | null;
  categoryLabel: string | null;
  colorHex: string | null;
  locationText: string | null;
  startAt: string; // ISO
  endAt: string | null; // ISO
  /** Set on first upload and then STABLE — a replacement reuses the same path,
   *  which is what keeps update_event from logging a spurious "Image changed". */
  imagePath: string | null;
  isPublished: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventInput = {
  title: string;
  description: string | null;
  categoryCode: string | null;
  locationText: string | null;
  /** The uploaded path, or the row's existing one round-tripped unchanged. */
  imagePath: string | null;
  startAt: string;
  endAt: string | null;
  isPublished: boolean;
};
