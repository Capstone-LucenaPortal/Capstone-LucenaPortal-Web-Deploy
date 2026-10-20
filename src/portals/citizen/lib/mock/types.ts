/** Record shapes for the dev-only localStorage mock store. */

export type RequestStatus =
  | 'Pending Review'
  | 'Approved'
  | 'Rejected'
  | 'Action Required'
  | 'Submitted'
  | 'Submitted (Unverified)'
  | 'Under Review'
  | 'Dispatched'
  | 'Resolved'
  | 'Invalid';

export interface StoredRequest {
  id: string;
  type: 'Yellow Card Application' | 'Incident Report' | 'Venue Booking';
  status: string;
  date: string;
  // Yellow Card fields
  ticketNumber?: string;
  arn?: string;
  verified?: boolean;
  // Incident fields
  // Venue Booking fields
  bookingNumber?: string;
  paymentRef?: string;
  details?: Record<string, unknown>;
}
