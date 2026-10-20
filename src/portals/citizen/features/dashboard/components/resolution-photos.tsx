'use client';

import { useEffect, useState } from 'react';
import { getIncidentPhotoUrl, getResolutionPhotos } from '@/portals/citizen/features/incidents/lib/incidents';

interface Props {
  incidentId: string;
}

interface Tile {
  id: string;
  url: string | null;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; tiles: Tile[] }
  | { status: 'error' };

/**
 * The responder's after photos, shown beside "Is it actually fixed?" (SCRUM-190).
 *
 * The responder must attach an after photo to resolve, and the Responder portal
 * tells them they are "looking at what the citizen will be shown" — but the
 * citizen was asked to confirm or reopen with no evidence at all.
 *
 * Each URL is signed per render through `getIncidentPhotoUrl`, which re-checks
 * entitlement and expires in a minute; nothing durable is ever handed out.
 *
 * ⚠️ A null URL is a placeholder tile, not a dropped one — the same rule as the
 * Responder's PhotoGrid. Dropping it would silently change how many photos the
 * department sent. And a load failure never blocks the decision: the Confirm and
 * Reopen buttons around this stay live whatever happens here.
 *
 * Plain <img>, not next/image: the URLs are short-lived signed Supabase links,
 * so the optimiser would need remotePatterns for something it cannot cache.
 */
export default function ResolutionPhotos({ incidentId }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    getResolutionPhotos(incidentId)
      .then(async (photos) => {
        const urls = await Promise.all(photos.map((p) => getIncidentPhotoUrl(p.id)));
        if (live) setState({ status: 'ready', tiles: photos.map((p, i) => ({ id: p.id, url: urls[i] })) });
      })
      .catch(() => {
        if (live) setState({ status: 'error' });
      });
    return () => {
      live = false;
    };
  }, [incidentId]);

  if (state.status === 'loading') return null;

  if (state.status === 'error') {
    return (
      <p style={{ fontSize: 13, color: '#666666', marginTop: 12 }}>
        We could not load the department’s photos right now. You can still confirm or reopen the report.
      </p>
    );
  }

  const { tiles } = state;
  if (tiles.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
        Photo{tiles.length === 1 ? '' : 's'} from the responding department
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
        {tiles.map((tile, index) =>
          tile.url ? (
            <img
              key={tile.id}
              src={tile.url}
              alt={`After photo ${index + 1} of ${tiles.length} from the responding department`}
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid #E5E7EB',
              }}
            />
          ) : (
            <div
              key={tile.id}
              style={{
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 8,
                fontSize: 12,
                color: '#666666',
                background: '#F9FAFB',
                border: '1px dashed #D1D5DB',
                borderRadius: 6,
              }}
            >
              This photo could not be loaded.
            </div>
          ),
        )}
      </div>
    </div>
  );
}
