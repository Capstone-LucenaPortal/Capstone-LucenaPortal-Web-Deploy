import { describe, it, expect, vi } from 'vitest';
import { profileService, translateProfileUpdateError } from '@/portals/citizen/features/profile/lib/profile';
import * as supabaseClientModule from '@/portals/citizen/lib/supabase/client';

describe('profileService in mock mode (no backend)', () => {
  it('getMyProfile resolves null when no backend is configured', async () => {
    expect(await profileService.getMyProfile()).toBeNull();
  });

  it('updateProfile resolves without throwing when no backend is configured', async () => {
    await expect(profileService.updateProfile({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      birthDate: '1990-01-15',
      genderCode: 'male',
      mobile: '09171234567',
      barangayCode: 'bocohan',
      street: 'Rizal Street',
      houseNo: '123',
    })).resolves.toBeUndefined();
  });
});

/**
 * updateProfile only validates on the live path (mock mode is a client-side
 * fake with no server to protect), so these tests install a fake Supabase
 * client (pattern copied from authService.test.ts's logout-failure test) and
 * assert the RPC is never reached when the fields are bad.
 */
describe('profileService.updateProfile field validation (live path)', () => {
  function withFakeClient() {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const fakeClient = { rpc } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(fakeClient);
    return { rpc, spy };
  }

  const VALID_FIELDS = {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    birthDate: '1990-01-15',
    genderCode: 'male',
    mobile: '09171234567',
    barangayCode: 'bocohan',
    street: 'Rizal Street',
    houseNo: '123',
  };

  it('rejects an oversize name without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        profileService.updateProfile({ ...VALID_FIELDS, firstName: 'a'.repeat(81) }),
      ).rejects.toThrow(Error);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects an oversize street/address without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        profileService.updateProfile({ ...VALID_FIELDS, street: 'a'.repeat(301) }),
      ).rejects.toThrow(Error);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a malformed mobile number without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        profileService.updateProfile({ ...VALID_FIELDS, mobile: '12345' }),
      ).rejects.toThrow(Error);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('allows an empty mobile (optional field) through to the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        profileService.updateProfile({ ...VALID_FIELDS, mobile: '' }),
      ).resolves.toBeUndefined();
      expect(rpc).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('accepts valid fields and calls the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await profileService.updateProfile({ ...VALID_FIELDS });
      expect(rpc).toHaveBeenCalledWith('update_citizen_profile', expect.any(Object));
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects an oversize house number without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        profileService.updateProfile({ ...VALID_FIELDS, houseNo: 'a'.repeat(121) }),
      ).rejects.toThrow(Error);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('allows an empty house number (optional field) through to the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        profileService.updateProfile({ ...VALID_FIELDS, houseNo: '' }),
      ).resolves.toBeUndefined();
      expect(rpc).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects an invalid birth date without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        profileService.updateProfile({ ...VALID_FIELDS, birthDate: '2999-01-01' }),
      ).rejects.toThrow(Error);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('translateProfileUpdateError', () => {
  // These two will never succeed on a retry, so "please try again later" was
  // actively misleading for both.
  it('names the barangay on a 23503, rather than suggesting a retry', () => {
    const msg = translateProfileUpdateError('23503');
    expect(msg).toMatch(/barangay/i);
    expect(msg).not.toMatch(/try again later/i);
  });

  it('explains an anonymised profile instead of suggesting a retry', () => {
    const msg = translateProfileUpdateError('42501');
    expect(msg).toMatch(/anonymised/i);
    expect(msg).not.toMatch(/try again later/i);
  });

  it('falls back to the generic message for an unknown code', () => {
    expect(translateProfileUpdateError('XX999')).toMatch(/try again later/i);
  });

  it('never leaks raw Postgres text', () => {
    for (const code of ['23503', '42501', 'P0002', '22023', undefined]) {
      expect(translateProfileUpdateError(code)).not.toMatch(/constraint|relation|column/i);
    }
  });
});
