'use client';

import { isBackendConfigured } from '@/portals/citizen/lib/supabase/client';

/** Dev-only warning strip so nobody mistakes mock mode for the real backend. */
export default function MockModeBanner() {
  if (isBackendConfigured() || process.env.NODE_ENV === 'production') return null;
  return (
    <div
      role="status"
      style={{ background: '#7A1F1F', color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 13, fontWeight: 600 }}
    >
      MOCK MODE — no backend configured. Logins are fake and submissions go to localStorage only.
    </div>
  );
}
