/** Domain types for the auth slice. */

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface CitizenProfileFields {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  birthDate: string;    // 'YYYY-MM-DD'
  genderCode: string;   // 'male' | 'female'
  mobile?: string;
  barangayCode: string; // public_barangays.code
  street?: string;
  houseNo?: string;
  occupation?: string;
  worksInLucena?: boolean;
  agreedToTerms: boolean; // must be true — enforced server-side by create_citizen_profile
}

export interface SignupData extends CitizenProfileFields {
  fullName: string;
  email: string;
  password: string;
}

/** The two ways a sign-up succeeds. `confirm-email`: email confirmation is on,
 * so there is no session yet and the citizen is not signed in; the profile is
 * created from user_metadata once the email link lands on /complete-signup. */
export type SignupResult =
  | { status: 'signed-in'; user: User }
  | { status: 'confirm-email' };
