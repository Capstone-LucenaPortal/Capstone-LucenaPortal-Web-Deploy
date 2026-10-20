import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectFn = vi.fn(async () => ({ data: [{ code: 'BGY1', label: 'Barangay 1' }], error: null }));
vi.mock('@/portals/citizen/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: () => ({ select: selectFn }) }),
}));

describe('catalog caching', () => {
  beforeEach(async () => {
    selectFn.mockClear();
    const mod = await import('@/portals/citizen/lib/supabase/catalogs');
    mod._clearCatalogCacheForTests();
  });

  it('serves repeat reads from cache within the TTL', async () => {
    const { catalogService } = await import('@/portals/citizen/lib/supabase/catalogs');
    await catalogService.getBarangays();
    await catalogService.getBarangays();
    expect(selectFn).toHaveBeenCalledTimes(1);
  });

  it('caches distinct catalogs independently', async () => {
    const { catalogService } = await import('@/portals/citizen/lib/supabase/catalogs');
    await catalogService.getBarangays();
    await catalogService.getGenders();
    await catalogService.getBarangays();
    await catalogService.getGenders();
    expect(selectFn).toHaveBeenCalledTimes(2);
  });
});
