import { describe, it, expect } from 'vitest';
import { toOptions, catalogService } from '@/portals/citizen/lib/supabase/catalogs';

describe('toOptions', () => {
  it('maps code/label and sorts by sort_order', () => {
    const rows = [
      { code: 'b', label: 'Bee', sort_order: 2 },
      { code: 'a', label: 'Ay', sort_order: 1 },
    ];
    expect(toOptions(rows)).toEqual([
      { code: 'a', label: 'Ay' },
      { code: 'b', label: 'Bee' },
    ]);
  });

  it('supports an alternate label key (barangays use `name`)', () => {
    const rows = [{ code: 'brgy_1', name: 'Barangay 1 (Poblacion)', sort_order: 1 }];
    expect(toOptions(rows, 'name')).toEqual([{ code: 'brgy_1', label: 'Barangay 1 (Poblacion)' }]);
  });
});

describe('catalogService with no backend', () => {
  it('returns [] when the Supabase client is not configured', async () => {
    expect(await catalogService.getBarangays()).toEqual([]);
    expect(await catalogService.getIncidentTypes()).toEqual([]);
  });

  it('getYellowCardConfig resolves null when the Supabase client is not configured', async () => {
    expect(await catalogService.getYellowCardConfig()).toBeNull();
  });

  it('getBookingVenueRates resolves [] when the Supabase client is not configured', async () => {
    expect(await catalogService.getBookingVenueRates()).toEqual([]);
  });

  it('getBookingConfig resolves null when the Supabase client is not configured', async () => {
    expect(await catalogService.getBookingConfig()).toBeNull();
  });

  it('getBookingVenueDetails resolves [] when the Supabase client is not configured', async () => {
    expect(await catalogService.getBookingVenueDetails()).toEqual([]);
  });

  it('getIncidentTypeDetails resolves [] when the Supabase client is not configured', async () => {
    expect(await catalogService.getIncidentTypeDetails()).toEqual([]);
  });

  it('getIncidentConfig resolves null when the Supabase client is not configured', async () => {
    expect(await catalogService.getIncidentConfig()).toBeNull();
  });

  it('getDepartments resolves [] when the Supabase client is not configured', async () => {
    expect(await catalogService.getDepartments()).toEqual([]);
  });

  it('getSiteInfo resolves null when the Supabase client is not configured', async () => {
    expect(await catalogService.getSiteInfo()).toBeNull();
  });

  it('getSiteInfoEntries resolves [] when the Supabase client is not configured', async () => {
    expect(await catalogService.getSiteInfoEntries('emergency_hotline')).toEqual([]);
  });

  it('getYellowCardDocumentTypes resolves [] when the Supabase client is not configured', async () => {
    expect(await catalogService.getYellowCardDocumentTypes()).toEqual([]);
  });

  // The wrappers read `catalogService.getSiteInfoEntries`, not `this`, so they
  // keep working when a caller destructures them off the service object.
  it('the site-info wrappers survive being destructured', async () => {
    const { getEmergencyHotlines, getFloorDirectory } = catalogService;
    expect(await getEmergencyHotlines()).toEqual([]);
    expect(await getFloorDirectory()).toEqual([]);
  });
});
