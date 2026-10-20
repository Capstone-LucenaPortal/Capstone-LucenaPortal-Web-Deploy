import { describe, it, expect, vi } from 'vitest';

// vi.mock is file-wide (hoisted), which is why this lives in its own file rather than
// bookingService.test.ts — that suite depends on getSupabaseClient() returning the real
// (null) client to exercise the mock-mode branches.
vi.mock('@/portals/citizen/lib/supabase/client', () => {
  const rpc = vi.fn(async (fn: string) => {
    if (fn === 'request_booking_document_upload') {
      return { data: [{ row_id: 'row-1', bucket: 'booking-documents', storage_path: 'bk/1/row-1.png' }], error: null };
    }
    return { data: null, error: null }; // confirm_upload
  });
  const upload = vi.fn(async () => ({ error: null }));
  const client = { rpc, storage: { from: () => ({ upload }) } };
  return { getSupabaseClient: () => client, __mock: { rpc, upload } };
});

describe('bookingService.uploadBookingDocument resumability', () => {
  it('retry with the same progress object does not reserve or upload twice', async () => {
    const { bookingService } = await import('@/portals/citizen/features/booking/lib/booking');
    const { __mock } = (await import('@/portals/citizen/lib/supabase/client')) as never as {
      __mock: { rpc: ReturnType<typeof vi.fn>; upload: ReturnType<typeof vi.fn> };
    };
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'a.png', { type: 'image/png' });
    const progress = {};
    await bookingService.uploadBookingDocument('bk-1', 'org_document', file, undefined, progress);
    await bookingService.uploadBookingDocument('bk-1', 'org_document', file, undefined, progress);
    expect(__mock.rpc.mock.calls.filter(([fn]) => fn === 'request_booking_document_upload')).toHaveLength(1);
    expect(__mock.upload).toHaveBeenCalledTimes(1);
  });
});
