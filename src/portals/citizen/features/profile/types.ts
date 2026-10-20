/** Domain types for the citizen-profile slice. */

export interface MyProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  suffix: string | null;
  birth_date: string | null;
  gender_code: string | null;
  gender_label: string | null;
  mobile: string | null;
  barangay_code: string | null;
  barangay_name: string | null;
  street: string | null;
  house_no: string | null;
  occupation: string | null;
  works_in_lucena: boolean | null;
  /** When this citizen accepted the Terms, and which version. Both live on
   * my_profile (DB layer l40) and were simply never read, so the portal could
   * not tell a citizen what they had agreed to or when — something RA 10173
   * expects a data subject to be able to see. */
  terms_accepted_at: string | null;
  terms_version: string | null;
  /** Non-null once the account has been anonymised (an erasure tombstone).
   * update_citizen_profile refuses on such a row, so the profile form has to
   * stop offering to save rather than failing at the end. */
  anonymised_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UpdateProfileFields {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  birthDate: string;
  genderCode: string;
  mobile?: string;
  barangayCode?: string;
  street?: string;
  houseNo?: string;
  occupation?: string;
  worksInLucena?: boolean;
}
