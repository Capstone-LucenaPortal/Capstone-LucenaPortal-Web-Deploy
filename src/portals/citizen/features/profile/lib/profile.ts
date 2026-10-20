import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import { LIMITS, fieldTooLong, phMobileError, birthDateError } from '@/portals/citizen/lib/validation';
import type { MyProfile, UpdateProfileFields } from '../types';

export const profileService = {
  /** Reads the caller's own citizen profile. null when no backend, or no citizens row exists yet. */
  async getMyProfile(): Promise<MyProfile | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('my_profile').select('*').maybeSingle();
    if (error) throw new Error('Could not load your profile right now. Please try again later.');
    return (data as MyProfile) ?? null;
  },

  async updateProfile(fields: UpdateProfileFields): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const orNull = (v?: string) => (v && v.trim() ? v.trim() : null);

    const problem =
      fieldTooLong('First name', fields.firstName.trim(), LIMITS.name) ??
      fieldTooLong('Last name', fields.lastName.trim(), LIMITS.name) ??
      fieldTooLong('Street', fields.street?.trim() ?? '', LIMITS.address) ??
      fieldTooLong('Occupation', fields.occupation?.trim() ?? '', LIMITS.shortText) ??
      (fields.houseNo?.trim() ? fieldTooLong('House number', fields.houseNo.trim(), LIMITS.shortText) : null) ??
      (fields.mobile?.trim() ? phMobileError(fields.mobile.trim()) : null) ??
      (fields.birthDate ? birthDateError(fields.birthDate) : null);
    if (problem) throw new Error(problem);

    const params = {
      p_first_name: fields.firstName.trim(),
      p_last_name: fields.lastName.trim(),
      p_birth_date: fields.birthDate,
      p_gender_code: fields.genderCode,
      p_middle_name: orNull(fields.middleName),
      p_suffix: orNull(fields.suffix),
      p_mobile: orNull(fields.mobile),
      p_barangay_code: orNull(fields.barangayCode),
      p_street: orNull(fields.street),
      p_house_no: orNull(fields.houseNo),
      p_occupation: orNull(fields.occupation),
      p_works_in_lucena: typeof fields.worksInLucena === 'boolean' ? fields.worksInLucena : null,
    };
    const { error } = await client.rpc('update_citizen_profile', params);
    if (error) throw new Error(translateProfileUpdateError(error.code));
  },
};

/**
 * Pure: an `update_citizen_profile` errcode -> a sentence written for a citizen.
 *
 * Every failure used to collapse into one "please try again later", which is
 * actively misleading for the two cases that will never succeed on a retry: a
 * barangay the city has deactivated since the form loaded, and a profile that
 * has been anonymised (an RA 10173 erasure tombstone — there is nothing left to
 * update, and no amount of retrying changes that).
 */
export function translateProfileUpdateError(code: string | undefined): string {
  switch (code) {
    case '23503':
      return 'That barangay is no longer available. Please choose another.';
    case '42501':
      return 'This account has been anonymised, so its details can no longer be changed. Please contact the Lucena City Hall trunkline if you need help.';
    case 'P0002':
      return 'We could not find your profile. Please sign out and sign in again.';
    case '22023':
      return 'Please check that every required field is filled in correctly.';
    default:
      return 'Could not save your profile changes. Please try again later.';
  }
}
