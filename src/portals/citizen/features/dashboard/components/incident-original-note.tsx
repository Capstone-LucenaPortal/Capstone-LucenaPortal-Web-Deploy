'use client';

interface Props {
  /** `my_incidents.original_reference` (l85): set only on a Duplicate. */
  originalReference: string | null;
}

/**
 * Which report a Duplicate was closed against, so the card agrees with the
 * "not accepted" notice the citizen was sent, which names the same reference.
 * A reference, never a link: the Original is usually another citizen's report,
 * and this citizen has nothing to open.
 */
export default function IncidentOriginalNote({ originalReference }: Props) {
  if (!originalReference) return null;
  return (
    <p style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>
      Duplicate of: <strong>{originalReference}</strong>
    </p>
  );
}
