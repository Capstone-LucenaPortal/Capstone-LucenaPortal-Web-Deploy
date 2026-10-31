export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      acknowledgement_receipts: {
        Row: {
          agency_name: string
          booking_id: string | null
          citizen_id: string
          id: string
          incident_id: string | null
          issued_at: string
          officer_designation: string
          officer_full_name: string
          officer_is_placeholder: boolean
          officer_unit: string
          received_at: string
          reference_number: string
          seal_path: string
          service: Database["public"]["Enums"]["module_code"]
          yellow_card_application_id: string | null
        }
        Insert: {
          agency_name: string
          booking_id?: string | null
          citizen_id: string
          id?: string
          incident_id?: string | null
          issued_at?: string
          officer_designation: string
          officer_full_name: string
          officer_is_placeholder: boolean
          officer_unit: string
          received_at: string
          reference_number: string
          seal_path: string
          service: Database["public"]["Enums"]["module_code"]
          yellow_card_application_id?: string | null
        }
        Update: {
          agency_name?: string
          booking_id?: string | null
          citizen_id?: string
          id?: string
          incident_id?: string | null
          issued_at?: string
          officer_designation?: string
          officer_full_name?: string
          officer_is_placeholder?: boolean
          officer_unit?: string
          received_at?: string
          reference_number?: string
          seal_path?: string
          service?: Database["public"]["Enums"]["module_code"]
          yellow_card_application_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_id: string | null
          actor_name: string
          area: Database["public"]["Enums"]["audit_area"]
          change: string
          changes: Json | null
          detail: string | null
          id: string
          ip_address: unknown
          occurred_at: string
          session_id: string | null
          target_id: string | null
          target_kind: Database["public"]["Enums"]["audit_target_kind"]
          target_label: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name: string
          area: Database["public"]["Enums"]["audit_area"]
          change: string
          changes?: Json | null
          detail?: string | null
          id?: string
          ip_address?: unknown
          occurred_at?: string
          session_id?: string | null
          target_id?: string | null
          target_kind: Database["public"]["Enums"]["audit_target_kind"]
          target_label: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string
          area?: Database["public"]["Enums"]["audit_area"]
          change?: string
          changes?: Json | null
          detail?: string | null
          id?: string
          ip_address?: unknown
          occurred_at?: string
          session_id?: string | null
          target_id?: string | null
          target_kind?: Database["public"]["Enums"]["audit_target_kind"]
          target_label?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      barangays: {
        Row: {
          code: string
          is_active: boolean
          is_poblacion: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          is_poblacion?: boolean
          name: string
          sort_order: number
        }
        Update: {
          code?: string
          is_active?: boolean
          is_poblacion?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      booking_classifications: {
        Row: {
          code: string
          is_discount_eligible: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_discount_eligible?: boolean
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          is_discount_eligible?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      booking_config: {
        Row: {
          balance_due_days_before_event: number
          closing_hour: number
          downpayment_pct: number
          id: boolean
          min_duration_hours: number
          opening_hour: number
          payment_window_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          balance_due_days_before_event?: number
          closing_hour?: number
          downpayment_pct?: number
          id?: boolean
          min_duration_hours?: number
          opening_hour?: number
          payment_window_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          balance_due_days_before_event?: number
          closing_hour?: number
          downpayment_pct?: number
          id?: boolean
          min_duration_hours?: number
          opening_hour?: number
          payment_window_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_documents: {
        Row: {
          booking_id: string
          id: string
          kind: Database["public"]["Enums"]["booking_doc_kind"]
          mime_type: string | null
          payment_id: string | null
          reserved_at: string
          reserved_by: string | null
          size_bytes: number | null
          storage_path: string
          superseded_by: string | null
          uploaded_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          booking_id: string
          id?: string
          kind: Database["public"]["Enums"]["booking_doc_kind"]
          mime_type?: string | null
          payment_id?: string | null
          reserved_at?: string
          reserved_by?: string | null
          size_bytes?: number | null
          storage_path: string
          superseded_by?: string | null
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          booking_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_doc_kind"]
          mime_type?: string | null
          payment_id?: string | null
          reserved_at?: string
          reserved_by?: string | null
          size_bytes?: number | null
          storage_path?: string
          superseded_by?: string | null
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "booking_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "staff_booking_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "booking_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "staff_booking_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_event_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      booking_events: {
        Row: {
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_user_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
        }
        Insert: {
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_user_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["actor_role"]
          actor_user_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_occupancies: {
        Row: {
          booking_id: string
          during: unknown
          id: string
          space_code: string
        }
        Insert: {
          booking_id: string
          during: unknown
          id?: string
          space_code: string
        }
        Update: {
          booking_id?: string
          during?: unknown
          id?: string
          space_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_occupancies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_occupancies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_occupancies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_occupancies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_occupancies_space_code_fkey"
            columns: ["space_code"]
            isOneToOne: false
            referencedRelation: "booking_venue_spaces"
            referencedColumns: ["code"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount: number
          booking_id: string
          gcash_reference: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          official_receipt_no: string | null
          paid_at: string | null
          recorded_by: string | null
          rejected_reason: string | null
          submitted_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          gcash_reference?: string | null
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          official_receipt_no?: string | null
          paid_at?: string | null
          recorded_by?: string | null
          rejected_reason?: string | null
          submitted_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          gcash_reference?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"]
          official_receipt_no?: string | null
          paid_at?: string | null
          recorded_by?: string | null
          rejected_reason?: string | null
          submitted_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rehearsal_rates: {
        Row: {
          code: string
          hourly_rate: number
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          hourly_rate: number
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          hourly_rate?: number
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      booking_venue_rates: {
        Row: {
          base_fee: number | null
          extension_hourly: number | null
          hourly_rate: number | null
          requires_quote: boolean
          tier: Database["public"]["Enums"]["rate_tier"]
          venue_code: string
        }
        Insert: {
          base_fee?: number | null
          extension_hourly?: number | null
          hourly_rate?: number | null
          requires_quote?: boolean
          tier: Database["public"]["Enums"]["rate_tier"]
          venue_code: string
        }
        Update: {
          base_fee?: number | null
          extension_hourly?: number | null
          hourly_rate?: number | null
          requires_quote?: boolean
          tier?: Database["public"]["Enums"]["rate_tier"]
          venue_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_venue_rates_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_rates_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_rates_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      booking_venue_space_map: {
        Row: {
          space_code: string
          venue_code: string
        }
        Insert: {
          space_code: string
          venue_code: string
        }
        Update: {
          space_code?: string
          venue_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_venue_space_map_space_code_fkey"
            columns: ["space_code"]
            isOneToOne: false
            referencedRelation: "booking_venue_spaces"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_space_map_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_space_map_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_space_map_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      booking_venue_spaces: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      booking_venues: {
        Row: {
          capacity_label: string | null
          code: string
          is_active: boolean
          is_hourly: boolean
          label: string
          sort_order: number
        }
        Insert: {
          capacity_label?: string | null
          code: string
          is_active?: boolean
          is_hourly?: boolean
          label: string
          sort_order: number
        }
        Update: {
          capacity_label?: string | null
          code?: string
          is_active?: boolean
          is_hourly?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        Insert: {
          balance_amount?: number | null
          balance_settled_at?: string | null
          cancellation_reason?:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at?: string | null
          confirmed_at?: string | null
          contact_number: string
          contact_person: string
          created_at?: string
          downpayment_amount?: number | null
          downpayment_pct?: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at?: string | null
          id?: string
          is_resident?: boolean | null
          organization_name?: string | null
          origin_barangay_code?: string | null
          origin_locality?: string | null
          quoted_at?: string | null
          quoted_by?: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type?: string | null
          special_requirements?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          submitted_at?: string
          terms_accepted_at?: string
          tier_review_since?: string | null
          tier_revision_reason?: string | null
          tier_verified?: boolean
          total_fee?: number | null
          updated_at?: string
          venue_code: string
        }
        Update: {
          balance_amount?: number | null
          balance_settled_at?: string | null
          cancellation_reason?:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id?: string
          classification_code?: string
          completed_at?: string | null
          confirmed_at?: string | null
          contact_number?: string
          contact_person?: string
          created_at?: string
          downpayment_amount?: number | null
          downpayment_pct?: number | null
          duration_hours?: number
          email_address?: string
          estimated_headcount?: number
          event_date?: string
          event_title?: string
          event_type_code?: string
          hold_expires_at?: string | null
          id?: string
          is_resident?: boolean | null
          organization_name?: string | null
          origin_barangay_code?: string | null
          origin_locality?: string | null
          quoted_at?: string | null
          quoted_by?: string | null
          rate_tier?: Database["public"]["Enums"]["rate_tier"]
          reference_number?: string
          rehearsal_rate_type?: string | null
          special_requirements?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          submitted_at?: string
          terms_accepted_at?: string
          tier_review_since?: string | null
          tier_revision_reason?: string | null
          tier_verified?: boolean
          total_fee?: number | null
          updated_at?: string
          venue_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "public_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "super_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "public_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "super_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_origin_barangay_code_fkey"
            columns: ["origin_barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_origin_barangay_code_fkey"
            columns: ["origin_barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_quoted_by_fkey"
            columns: ["quoted_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quoted_by_fkey"
            columns: ["quoted_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quoted_by_fkey"
            columns: ["quoted_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rehearsal_rate_type_fkey"
            columns: ["rehearsal_rate_type"]
            isOneToOne: false
            referencedRelation: "booking_rehearsal_rates"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_rehearsal_rate_type_fkey"
            columns: ["rehearsal_rate_type"]
            isOneToOne: false
            referencedRelation: "public_booking_rehearsal_rates"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      citizens: {
        Row: {
          anonymised_at: string | null
          barangay_code: string | null
          birth_date: string
          created_at: string
          email: string
          first_name: string
          gender_code: string
          house_no: string | null
          id: string
          last_name: string
          middle_name: string | null
          mobile: string | null
          occupation: string | null
          street: string | null
          suffix: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          works_in_lucena: boolean | null
        }
        Insert: {
          anonymised_at?: string | null
          barangay_code?: string | null
          birth_date: string
          created_at?: string
          email: string
          first_name: string
          gender_code: string
          house_no?: string | null
          id: string
          last_name: string
          middle_name?: string | null
          mobile?: string | null
          occupation?: string | null
          street?: string | null
          suffix?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          works_in_lucena?: boolean | null
        }
        Update: {
          anonymised_at?: string | null
          barangay_code?: string | null
          birth_date?: string
          created_at?: string
          email?: string
          first_name?: string
          gender_code?: string
          house_no?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          mobile?: string | null
          occupation?: string | null
          street?: string | null
          suffix?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          works_in_lucena?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "citizens_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "citizens_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "citizens_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "genders"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "citizens_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "public_genders"
            referencedColumns: ["code"]
          },
        ]
      }
      civil_statuses: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      genders: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["holiday_kind"]
          name: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["holiday_kind"]
          name: string
          source: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["holiday_kind"]
          name?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_categories: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      incident_config: {
        Row: {
          at_risk_threshold_pct: number
          auto_close_day: number
          confirmation_window_days: number
          id: boolean
          max_active_reports_per_citizen: number
          max_photos_per_cycle: number
          nudge_day: number
          sla_hours_critical: number
          sla_hours_high: number
          sla_hours_low: number
          sla_hours_medium: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          at_risk_threshold_pct?: number
          auto_close_day?: number
          confirmation_window_days?: number
          id?: boolean
          max_active_reports_per_citizen?: number
          max_photos_per_cycle?: number
          nudge_day?: number
          sla_hours_critical?: number
          sla_hours_high?: number
          sla_hours_low?: number
          sla_hours_medium?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          at_risk_threshold_pct?: number
          auto_close_day?: number
          confirmation_window_days?: number
          id?: boolean
          max_active_reports_per_citizen?: number
          max_photos_per_cycle?: number
          nudge_day?: number
          sla_hours_critical?: number
          sla_hours_high?: number
          sla_hours_low?: number
          sla_hours_medium?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_events: {
        Row: {
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_user_id: string | null
          created_at: string
          cycle_number: number
          event_type: Database["public"]["Enums"]["incident_event_type"]
          id: string
          incident_id: string
          note: string | null
        }
        Insert: {
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_user_id?: string | null
          created_at?: string
          cycle_number?: number
          event_type: Database["public"]["Enums"]["incident_event_type"]
          id?: string
          incident_id: string
          note?: string | null
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["actor_role"]
          actor_user_id?: string | null
          created_at?: string
          cycle_number?: number
          event_type?: Database["public"]["Enums"]["incident_event_type"]
          id?: string
          incident_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_photos: {
        Row: {
          cycle_number: number
          id: string
          incident_id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          mime_type: string | null
          reserved_at: string
          reserved_by: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          cycle_number?: number
          id?: string
          incident_id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          mime_type?: string | null
          reserved_at?: string
          reserved_by?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          cycle_number?: number
          id?: string
          incident_id?: string
          kind?: Database["public"]["Enums"]["photo_kind"]
          mime_type?: string | null
          reserved_at?: string
          reserved_by?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_types: {
        Row: {
          base_level: Database["public"]["Enums"]["incident_level"]
          category_code: string
          code: string
          default_department_code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          base_level: Database["public"]["Enums"]["incident_level"]
          category_code: string
          code: string
          default_department_code: string
          is_active?: boolean
          label: string
          sort_order: number
        }
        Update: {
          base_level?: Database["public"]["Enums"]["incident_level"]
          category_code?: string
          code?: string
          default_department_code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      incidents: {
        Row: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address: string
          assigned_department_code?: string | null
          assigned_responder_id?: string | null
          barangay_code: string
          citizen_id: string
          closed_at?: string | null
          closure_reason?: Database["public"]["Enums"]["closure_reason"] | null
          created_at?: string
          description: string
          duplicate_of?: string | null
          id?: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous?: boolean
          is_verified?: boolean
          pooled_at?: string | null
          reference_number: string
          reopened_count?: number
          resolved_at?: string | null
          routed_at?: string | null
          sla_armed_at?: string | null
          sla_due_at?: string | null
          sla_target_hours?: number | null
          status?: Database["public"]["Enums"]["incident_status"]
          submitted_at?: string
          suggested_department_code: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address?: string
          assigned_department_code?: string | null
          assigned_responder_id?: string | null
          barangay_code?: string
          citizen_id?: string
          closed_at?: string | null
          closure_reason?: Database["public"]["Enums"]["closure_reason"] | null
          created_at?: string
          description?: string
          duplicate_of?: string | null
          id?: string
          incident_level?: Database["public"]["Enums"]["incident_level"]
          incident_type_code?: string
          is_anonymous?: boolean
          is_verified?: boolean
          pooled_at?: string | null
          reference_number?: string
          reopened_count?: number
          resolved_at?: string | null
          routed_at?: string | null
          sla_armed_at?: string | null
          sla_due_at?: string | null
          sla_target_hours?: number | null
          status?: Database["public"]["Enums"]["incident_status"]
          submitted_at?: string
          suggested_department_code?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "public_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "super_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at: string
          error: string | null
          event_code: string
          id: string
          is_mocked: boolean
          module_code: Database["public"]["Enums"]["module_code"]
          next_attempt_at: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient_user_id: string
          record_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notify_status"]
          title: string
        }
        Insert: {
          attempts?: number
          body: string
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          error?: string | null
          event_code: string
          id?: string
          is_mocked?: boolean
          module_code: Database["public"]["Enums"]["module_code"]
          next_attempt_at?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient_user_id: string
          record_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notify_status"]
          title: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          error?: string | null
          event_code?: string
          id?: string
          is_mocked?: boolean
          module_code?: Database["public"]["Enums"]["module_code"]
          next_attempt_at?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient_user_id?: string
          record_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notify_status"]
          title?: string
        }
        Relationships: []
      }
      office_hours: {
        Row: {
          close_time: string | null
          iso_weekday: number
          open_time: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          close_time?: string | null
          iso_weekday: number
          open_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          close_time?: string | null
          iso_weekday?: number
          open_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      officers_of_record: {
        Row: {
          designation: string
          full_name: string
          is_placeholder: boolean
          service: Database["public"]["Enums"]["module_code"]
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          designation: string
          full_name: string
          is_placeholder?: boolean
          service: Database["public"]["Enums"]["module_code"]
          unit: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          designation?: string
          full_name?: string
          is_placeholder?: boolean
          service?: Database["public"]["Enums"]["module_code"]
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officers_of_record_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officers_of_record_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officers_of_record_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_city_events: {
        Row: {
          category_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          image_path: string | null
          is_published: boolean
          location_text: string
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          category_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          image_path?: string | null
          is_published?: boolean
          location_text: string
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          category_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          image_path?: string | null
          is_published?: boolean
          location_text?: string
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "platform_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "super_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_city_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_city_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_contact_messages: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_points_of_interest: {
        Row: {
          address: string | null
          badge: string | null
          created_at: string
          description: string
          id: string
          image_path: string | null
          is_published: boolean
          maps_query: string | null
          name: string
          section: Database["public"]["Enums"]["poi_section"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          badge?: string | null
          created_at?: string
          description: string
          id?: string
          image_path?: string | null
          is_published?: boolean
          maps_query?: string | null
          name: string
          section: Database["public"]["Enums"]["poi_section"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          badge?: string | null
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          is_published?: boolean
          maps_query?: string | null
          name?: string
          section?: Database["public"]["Enums"]["poi_section"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_post_categories: {
        Row: {
          code: string
          color_hex: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          color_hex: string
          is_active?: boolean
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          color_hex?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      platform_posts: {
        Row: {
          body: string
          category_code: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          created_by: string | null
          end_at: string | null
          id: string
          image_path: string | null
          is_published: boolean
          start_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category_code: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          id?: string
          image_path?: string | null
          is_published?: boolean
          start_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category_code?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          id?: string
          image_path?: string | null
          is_published?: boolean
          start_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "platform_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "super_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          key_auth: string
          key_p256dh: string
          staff_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          key_auth: string
          key_p256dh: string
          staff_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          key_auth?: string
          key_p256dh?: string
          staff_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_counters: {
        Row: {
          last_value: number
          prefix: string
          year: number
        }
        Insert: {
          last_value?: number
          prefix: string
          year: number
        }
        Update: {
          last_value?: number
          prefix?: string
          year?: number
        }
        Relationships: []
      }
      site_info: {
        Row: {
          agency_name: string
          id: boolean
          office_hours: string
          seal_path: string
          trunkline: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_name: string
          id?: boolean
          office_hours: string
          seal_path: string
          trunkline: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_name?: string
          id?: boolean
          office_hours?: string
          seal_path?: string
          trunkline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_info_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_info_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_info_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      site_info_entries: {
        Row: {
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["site_info_kind"]
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["site_info_kind"]
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["site_info_kind"]
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_info_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_info_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_info_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_accounts: {
        Row: {
          created_at: string
          department_code: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_supervisor: boolean
          last_change_at: string
          modules: Database["public"]["Enums"]["module_code"][]
          on_duty: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: string
        }
        Insert: {
          created_at?: string
          department_code?: string | null
          email: string
          employee_id?: string | null
          full_name: string
          id: string
          is_supervisor?: boolean
          last_change_at?: string
          modules?: Database["public"]["Enums"]["module_code"][]
          on_duty?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status?: string
        }
        Update: {
          created_at?: string
          department_code?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          is_supervisor?: boolean
          last_change_at?: string
          modules?: Database["public"]["Enums"]["module_code"][]
          on_duty?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      system_health_samples: {
        Row: {
          accounts_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          connections: number
          database_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          db_bytes: number
          email_bounced_24h: number
          email_failed_24h: number
          email_oldest_queued_seconds: number | null
          email_queued: number
          id: number
          incidents_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          jobs_failed_24h: number
          jobs_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          lcc_status: Database["public"]["Enums"]["system_health_status"] | null
          notifications_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          push_bounced_24h: number
          push_failed_24h: number
          push_oldest_queued_seconds: number | null
          push_queued: number
          sampled_at: string
          status: Database["public"]["Enums"]["system_health_status"]
          storage_bytes: number
          storage_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          yellow_card_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
        }
        Insert: {
          accounts_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          connections: number
          database_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          db_bytes: number
          email_bounced_24h: number
          email_failed_24h: number
          email_oldest_queued_seconds?: number | null
          email_queued: number
          id?: never
          incidents_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          jobs_failed_24h: number
          jobs_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          lcc_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          notifications_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          push_bounced_24h: number
          push_failed_24h: number
          push_oldest_queued_seconds?: number | null
          push_queued: number
          sampled_at?: string
          status: Database["public"]["Enums"]["system_health_status"]
          storage_bytes: number
          storage_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          yellow_card_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
        }
        Update: {
          accounts_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          connections?: number
          database_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          db_bytes?: number
          email_bounced_24h?: number
          email_failed_24h?: number
          email_oldest_queued_seconds?: number | null
          email_queued?: number
          id?: never
          incidents_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          jobs_failed_24h?: number
          jobs_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          lcc_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          notifications_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          push_bounced_24h?: number
          push_failed_24h?: number
          push_oldest_queued_seconds?: number | null
          push_queued?: number
          sampled_at?: string
          status?: Database["public"]["Enums"]["system_health_status"]
          storage_bytes?: number
          storage_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          yellow_card_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
        }
        Relationships: []
      }
      yellow_card_applications: {
        Row: {
          barangay_code: string
          citizen_id: string
          civil_status_code: string
          complete_address: string
          contact_number: string
          created_at: string
          current_review_id: string | null
          date_of_birth: string
          decided_at: string | null
          due_at: string | null
          email_address: string
          first_name: string
          gender_code: string
          id: string
          last_name: string
          middle_name: string | null
          needs_dedup_review: boolean
          privacy_consent: boolean
          reference_number: string
          sla_clock_started_at: string | null
          sla_elapsed_seconds: number
          sla_target_hours: number
          status: Database["public"]["Enums"]["yellow_card_application_status"]
          submitted_at: string
          suffix: string | null
          updated_at: string
          voter_id_number: string
          voter_id_number_normalized: string | null
          years_of_residency: number
        }
        Insert: {
          barangay_code: string
          citizen_id: string
          civil_status_code: string
          complete_address: string
          contact_number: string
          created_at?: string
          current_review_id?: string | null
          date_of_birth: string
          decided_at?: string | null
          due_at?: string | null
          email_address: string
          first_name: string
          gender_code: string
          id?: string
          last_name: string
          middle_name?: string | null
          needs_dedup_review?: boolean
          privacy_consent: boolean
          reference_number: string
          sla_clock_started_at?: string | null
          sla_elapsed_seconds?: number
          sla_target_hours: number
          status?: Database["public"]["Enums"]["yellow_card_application_status"]
          submitted_at?: string
          suffix?: string | null
          updated_at?: string
          voter_id_number: string
          voter_id_number_normalized?: string | null
          years_of_residency: number
        }
        Update: {
          barangay_code?: string
          citizen_id?: string
          civil_status_code?: string
          complete_address?: string
          contact_number?: string
          created_at?: string
          current_review_id?: string | null
          date_of_birth?: string
          decided_at?: string | null
          due_at?: string | null
          email_address?: string
          first_name?: string
          gender_code?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          needs_dedup_review?: boolean
          privacy_consent?: boolean
          reference_number?: string
          sla_clock_started_at?: string | null
          sla_elapsed_seconds?: number
          sla_target_hours?: number
          status?: Database["public"]["Enums"]["yellow_card_application_status"]
          submitted_at?: string
          suffix?: string | null
          updated_at?: string
          voter_id_number?: string
          voter_id_number_normalized?: string | null
          years_of_residency?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_review"
            columns: ["current_review_id"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_current_review"
            columns: ["current_review_id"]
            isOneToOne: false
            referencedRelation: "yellow_card_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_applications_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_applications_civil_status_code_fkey"
            columns: ["civil_status_code"]
            isOneToOne: false
            referencedRelation: "civil_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_civil_status_code_fkey"
            columns: ["civil_status_code"]
            isOneToOne: false
            referencedRelation: "public_civil_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "genders"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "public_genders"
            referencedColumns: ["code"]
          },
        ]
      }
      yellow_card_categories: {
        Row: {
          code: string
          is_default: boolean
          label: string
        }
        Insert: {
          code: string
          is_default?: boolean
          label: string
        }
        Update: {
          code?: string
          is_default?: boolean
          label?: string
        }
        Relationships: []
      }
      yellow_card_classifications: {
        Row: {
          code: string
          is_default: boolean
          label: string
        }
        Insert: {
          code: string
          is_default?: boolean
          label: string
        }
        Update: {
          code?: string
          is_default?: boolean
          label?: string
        }
        Relationships: []
      }
      yellow_card_config: {
        Row: {
          at_risk_threshold_pct: number
          id: boolean
          processing_time_target_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          at_risk_threshold_pct?: number
          id?: boolean
          processing_time_target_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          at_risk_threshold_pct?: number
          id?: boolean
          processing_time_target_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yellow_card_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      yellow_card_document_types: {
        Row: {
          code: string
          is_active: boolean
          is_required: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          is_required?: boolean
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      yellow_card_documents: {
        Row: {
          application_id: string
          byte_size: number | null
          document_type_code: string
          id: string
          mime_type: string | null
          original_filename: string | null
          reserved_at: string
          reserved_by: string | null
          storage_path: string
          superseded_by: string | null
          uploaded_at: string | null
        }
        Insert: {
          application_id: string
          byte_size?: number | null
          document_type_code: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          reserved_at?: string
          reserved_by?: string | null
          storage_path: string
          superseded_by?: string | null
          uploaded_at?: string | null
        }
        Update: {
          application_id?: string
          byte_size?: number | null
          document_type_code?: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          reserved_at?: string
          reserved_by?: string | null
          storage_path?: string
          superseded_by?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_document_type_code_fkey"
            columns: ["document_type_code"]
            isOneToOne: false
            referencedRelation: "public_yellow_card_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_documents_document_type_code_fkey"
            columns: ["document_type_code"]
            isOneToOne: false
            referencedRelation: "super_yellow_card_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_documents_document_type_code_fkey"
            columns: ["document_type_code"]
            isOneToOne: false
            referencedRelation: "yellow_card_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "yellow_card_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      yellow_card_reviews: {
        Row: {
          application_id: string
          decision: Database["public"]["Enums"]["yellow_card_decision"]
          id: string
          reason: string | null
          reviewed_at: string
          reviewed_by: string
        }
        Insert: {
          application_id: string
          decision: Database["public"]["Enums"]["yellow_card_decision"]
          id?: string
          reason?: string | null
          reviewed_at?: string
          reviewed_by: string
        }
        Update: {
          application_id?: string
          decision?: Database["public"]["Enums"]["yellow_card_decision"]
          id?: string
          reason?: string | null
          reviewed_at?: string
          reviewed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      yellow_cards: {
        Row: {
          application_id: string
          barangay_code: string
          card_number: string
          category_code: string
          citizen_id: string
          classification_code: string
          created_at: string
          expires_at: string | null
          holder_name: string
          id: string
          issued_by: string | null
          revoked_reason: string | null
          status: Database["public"]["Enums"]["yellow_card_status"]
          valid_from: string
          verification_token: string
          voter_id_number_normalized: string
        }
        Insert: {
          application_id: string
          barangay_code: string
          card_number: string
          category_code: string
          citizen_id: string
          classification_code: string
          created_at?: string
          expires_at?: string | null
          holder_name: string
          id?: string
          issued_by?: string | null
          revoked_reason?: string | null
          status?: Database["public"]["Enums"]["yellow_card_status"]
          valid_from?: string
          verification_token?: string
          voter_id_number_normalized: string
        }
        Update: {
          application_id?: string
          barangay_code?: string
          card_number?: string
          category_code?: string
          citizen_id?: string
          classification_code?: string
          created_at?: string
          expires_at?: string | null
          holder_name?: string
          id?: string
          issued_by?: string | null
          revoked_reason?: string | null
          status?: Database["public"]["Enums"]["yellow_card_status"]
          valid_from?: string
          verification_token?: string
          voter_id_number_normalized?: string
        }
        Relationships: [
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_yellow_card_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "yellow_card_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "public_yellow_card_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "yellow_card_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_booking_analytics: {
        Row: {
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          classification_code: string | null
          completed_at: string | null
          confirmed_at: string | null
          duration_hours: number | null
          estimated_headcount: number | null
          event_date: string | null
          event_title: string | null
          event_type_code: string | null
          id: string | null
          is_resident: boolean | null
          lead_time_days: number | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"] | null
          reference_number: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          submitted_at: string | null
          tier_verified: boolean | null
          total_fee: number | null
          venue_code: string | null
        }
        Insert: {
          cancellation_reason?:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          classification_code?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          duration_hours?: number | null
          estimated_headcount?: number | null
          event_date?: string | null
          event_title?: string | null
          event_type_code?: string | null
          id?: string | null
          is_resident?: boolean | null
          lead_time_days?: never
          origin_barangay_code?: string | null
          origin_locality?: string | null
          quoted_at?: string | null
          rate_tier?: Database["public"]["Enums"]["rate_tier"] | null
          reference_number?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          submitted_at?: string | null
          tier_verified?: boolean | null
          total_fee?: number | null
          venue_code?: string | null
        }
        Update: {
          cancellation_reason?:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          classification_code?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          duration_hours?: number | null
          estimated_headcount?: number | null
          event_date?: string | null
          event_title?: string | null
          event_type_code?: string | null
          id?: string | null
          is_resident?: boolean | null
          lead_time_days?: never
          origin_barangay_code?: string | null
          origin_locality?: string | null
          quoted_at?: string | null
          rate_tier?: Database["public"]["Enums"]["rate_tier"] | null
          reference_number?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          submitted_at?: string | null
          tier_verified?: boolean | null
          total_fee?: number | null
          venue_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "public_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "super_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "public_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "super_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_origin_barangay_code_fkey"
            columns: ["origin_barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_origin_barangay_code_fkey"
            columns: ["origin_barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      admin_incident_analytics: {
        Row: {
          assigned_department_code: string | null
          barangay_code: string | null
          barangay_name: string | null
          category_code: string | null
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          id: string | null
          incident_level: Database["public"]["Enums"]["incident_level"] | null
          incident_type_code: string | null
          incident_type_label: string | null
          reference_number: string | null
          reopened_count: number | null
          resolved_at: string | null
          routed_at: string | null
          sla_met: boolean | null
          status: Database["public"]["Enums"]["incident_status"] | null
          submitted_at: string | null
          time_to_triage_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "public_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "super_incident_types"
            referencedColumns: ["code"]
          },
        ]
      }
      admin_yellow_card_analytics: {
        Row: {
          barangay_code: string | null
          barangay_name: string | null
          decided_at: string | null
          id: string | null
          reference_number: string | null
          review_cycles: number | null
          sla_breached: boolean | null
          sla_elapsed_seconds: number | null
          sla_target_hours: number | null
          status:
            | Database["public"]["Enums"]["yellow_card_application_status"]
            | null
          submitted_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      my_acknowledgement_receipts: {
        Row: {
          agency_name: string | null
          booking_id: string | null
          id: string | null
          incident_id: string | null
          issued_at: string | null
          officer_designation: string | null
          officer_full_name: string | null
          officer_is_placeholder: boolean | null
          officer_unit: string | null
          received_at: string | null
          received_at_manila: string | null
          reference_number: string | null
          seal_path: string | null
          service: Database["public"]["Enums"]["module_code"] | null
          yellow_card_application_id: string | null
        }
        Insert: {
          agency_name?: string | null
          booking_id?: string | null
          id?: string | null
          incident_id?: string | null
          issued_at?: string | null
          officer_designation?: string | null
          officer_full_name?: string | null
          officer_is_placeholder?: boolean | null
          officer_unit?: string | null
          received_at?: string | null
          received_at_manila?: never
          reference_number?: string | null
          seal_path?: string | null
          service?: Database["public"]["Enums"]["module_code"] | null
          yellow_card_application_id?: string | null
        }
        Update: {
          agency_name?: string | null
          booking_id?: string | null
          id?: string | null
          incident_id?: string | null
          issued_at?: string | null
          officer_designation?: string | null
          officer_full_name?: string | null
          officer_is_placeholder?: boolean | null
          officer_unit?: string | null
          received_at?: string | null
          received_at_manila?: never
          reference_number?: string | null
          seal_path?: string | null
          service?: Database["public"]["Enums"]["module_code"] | null
          yellow_card_application_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgement_receipts_yellow_card_application_id_fkey"
            columns: ["yellow_card_application_id"]
            isOneToOne: true
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      my_bookings: {
        Row: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          classification_code: string | null
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string | null
          contact_person: string | null
          document_count: number | null
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number | null
          email_address: string | null
          estimated_headcount: number | null
          event_date: string | null
          event_title: string | null
          event_type_code: string | null
          event_type_label: string | null
          hold_expires_at: string | null
          id: string | null
          organization_name: string | null
          payment_count: number | null
          quoted_at: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"] | null
          reference_number: string | null
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          submitted_at: string | null
          terms_accepted_at: string | null
          tier_revision_reason: string | null
          tier_verified: boolean | null
          total_fee: number | null
          venue_code: string | null
          venue_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "public_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "super_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "public_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "super_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_rehearsal_rate_type_fkey"
            columns: ["rehearsal_rate_type"]
            isOneToOne: false
            referencedRelation: "booking_rehearsal_rates"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_rehearsal_rate_type_fkey"
            columns: ["rehearsal_rate_type"]
            isOneToOne: false
            referencedRelation: "public_booking_rehearsal_rates"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      my_incident_photos: {
        Row: {
          cycle_number: number | null
          id: string | null
          incident_id: string | null
          is_current_cycle: boolean | null
          kind: Database["public"]["Enums"]["photo_kind"] | null
          uploaded_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      my_incidents: {
        Row: {
          address: string | null
          assigned_department_code: string | null
          assigned_department_label: string | null
          barangay_code: string | null
          barangay_name: string | null
          category_code: string | null
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          description: string | null
          id: string | null
          incident_level: Database["public"]["Enums"]["incident_level"] | null
          incident_type_code: string | null
          is_anonymous: boolean | null
          is_verified: boolean | null
          original_reference: string | null
          photo_count: number | null
          reference_number: string | null
          reopened_count: number | null
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"] | null
          submitted_at: string | null
          type_label: string | null
          verified_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "public_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "super_incident_types"
            referencedColumns: ["code"]
          },
        ]
      }
      my_notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notify_channel"] | null
          created_at: string | null
          event_code: string | null
          id: string | null
          module_code: Database["public"]["Enums"]["module_code"] | null
          read_at: string | null
          record_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notify_status"] | null
          title: string | null
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notify_channel"] | null
          created_at?: string | null
          event_code?: string | null
          id?: string | null
          module_code?: Database["public"]["Enums"]["module_code"] | null
          read_at?: string | null
          record_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notify_status"] | null
          title?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notify_channel"] | null
          created_at?: string | null
          event_code?: string | null
          id?: string | null
          module_code?: Database["public"]["Enums"]["module_code"] | null
          read_at?: string | null
          record_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notify_status"] | null
          title?: string | null
        }
        Relationships: []
      }
      my_profile: {
        Row: {
          anonymised_at: string | null
          barangay_code: string | null
          barangay_name: string | null
          birth_date: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          gender_code: string | null
          gender_label: string | null
          house_no: string | null
          id: string | null
          last_name: string | null
          middle_name: string | null
          mobile: string | null
          occupation: string | null
          street: string | null
          suffix: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string | null
          works_in_lucena: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "citizens_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "citizens_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "citizens_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "genders"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "citizens_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "public_genders"
            referencedColumns: ["code"]
          },
        ]
      }
      my_push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string | null
          id: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          id?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          id?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      my_staff_profile: {
        Row: {
          created_at: string | null
          department_code: string | null
          department_label: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string | null
          is_supervisor: boolean | null
          last_change_at: string | null
          modules: Database["public"]["Enums"]["module_code"][] | null
          on_duty: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"] | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      my_yellow_card_applications: {
        Row: {
          barangay_code: string | null
          barangay_name: string | null
          civil_status_code: string | null
          complete_address: string | null
          contact_number: string | null
          current_decision:
            | Database["public"]["Enums"]["yellow_card_decision"]
            | null
          current_reason: string | null
          current_reviewed_at: string | null
          date_of_birth: string | null
          decided_at: string | null
          document_count: number | null
          due_at: string | null
          email_address: string | null
          first_name: string | null
          gender_code: string | null
          id: string | null
          last_name: string | null
          middle_name: string | null
          needs_dedup_review: boolean | null
          privacy_consent: boolean | null
          reference_number: string | null
          sla_target_hours: number | null
          status:
            | Database["public"]["Enums"]["yellow_card_application_status"]
            | null
          submitted_at: string | null
          suffix: string | null
          voter_id_number: string | null
          years_of_residency: number | null
        }
        Relationships: [
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_civil_status_code_fkey"
            columns: ["civil_status_code"]
            isOneToOne: false
            referencedRelation: "civil_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_civil_status_code_fkey"
            columns: ["civil_status_code"]
            isOneToOne: false
            referencedRelation: "public_civil_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "genders"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "public_genders"
            referencedColumns: ["code"]
          },
        ]
      }
      my_yellow_cards: {
        Row: {
          application_id: string | null
          barangay_code: string | null
          barangay_name: string | null
          card_number: string | null
          category_code: string | null
          classification_code: string | null
          created_at: string | null
          expires_at: string | null
          holder_name: string | null
          id: string | null
          revoked_reason: string | null
          status: Database["public"]["Enums"]["yellow_card_status"] | null
          valid_from: string | null
          verification_token: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_cards_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_yellow_card_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "yellow_card_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "public_yellow_card_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_cards_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "yellow_card_classifications"
            referencedColumns: ["code"]
          },
        ]
      }
      public_barangays: {
        Row: {
          code: string | null
          is_poblacion: boolean | null
          name: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          is_poblacion?: boolean | null
          name?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          is_poblacion?: boolean | null
          name?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_booking_classifications: {
        Row: {
          code: string | null
          is_discount_eligible: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          is_discount_eligible?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          is_discount_eligible?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_booking_config: {
        Row: {
          balance_due_days_before_event: number | null
          closing_hour: number | null
          downpayment_pct: number | null
          min_duration_hours: number | null
          opening_hour: number | null
          payment_window_hours: number | null
        }
        Insert: {
          balance_due_days_before_event?: number | null
          closing_hour?: number | null
          downpayment_pct?: number | null
          min_duration_hours?: number | null
          opening_hour?: number | null
          payment_window_hours?: number | null
        }
        Update: {
          balance_due_days_before_event?: number | null
          closing_hour?: number | null
          downpayment_pct?: number | null
          min_duration_hours?: number | null
          opening_hour?: number | null
          payment_window_hours?: number | null
        }
        Relationships: []
      }
      public_booking_event_types: {
        Row: {
          code: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_booking_rehearsal_rates: {
        Row: {
          code: string | null
          hourly_rate: number | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          hourly_rate?: number | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          hourly_rate?: number | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_booking_venue_rates: {
        Row: {
          base_fee: number | null
          extension_hourly: number | null
          hourly_rate: number | null
          requires_quote: boolean | null
          tier: Database["public"]["Enums"]["rate_tier"] | null
          venue_code: string | null
        }
        Insert: {
          base_fee?: number | null
          extension_hourly?: number | null
          hourly_rate?: number | null
          requires_quote?: boolean | null
          tier?: Database["public"]["Enums"]["rate_tier"] | null
          venue_code?: string | null
        }
        Update: {
          base_fee?: number | null
          extension_hourly?: number | null
          hourly_rate?: number | null
          requires_quote?: boolean | null
          tier?: Database["public"]["Enums"]["rate_tier"] | null
          venue_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_venue_rates_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_rates_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_rates_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      public_booking_venues: {
        Row: {
          capacity_label: string | null
          code: string | null
          is_hourly: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          capacity_label?: string | null
          code?: string | null
          is_hourly?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          capacity_label?: string | null
          code?: string | null
          is_hourly?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_civil_statuses: {
        Row: {
          code: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_departments: {
        Row: {
          code: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_events: {
        Row: {
          category_code: string | null
          category_label: string | null
          color_hex: string | null
          description: string | null
          end_at: string | null
          id: string | null
          image_path: string | null
          location_text: string | null
          start_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "platform_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "super_post_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      public_genders: {
        Row: {
          code: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          holiday_date: string | null
          kind: Database["public"]["Enums"]["holiday_kind"] | null
          name: string | null
        }
        Insert: {
          holiday_date?: string | null
          kind?: Database["public"]["Enums"]["holiday_kind"] | null
          name?: string | null
        }
        Update: {
          holiday_date?: string | null
          kind?: Database["public"]["Enums"]["holiday_kind"] | null
          name?: string | null
        }
        Relationships: []
      }
      public_incident_categories: {
        Row: {
          code: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_incident_config: {
        Row: {
          auto_close_day: number | null
          confirmation_window_days: number | null
          max_active_reports_per_citizen: number | null
          max_photos_per_cycle: number | null
          nudge_day: number | null
          sla_hours_critical: number | null
          sla_hours_high: number | null
          sla_hours_low: number | null
          sla_hours_medium: number | null
        }
        Insert: {
          auto_close_day?: number | null
          confirmation_window_days?: number | null
          max_active_reports_per_citizen?: number | null
          max_photos_per_cycle?: number | null
          nudge_day?: number | null
          sla_hours_critical?: number | null
          sla_hours_high?: number | null
          sla_hours_low?: number | null
          sla_hours_medium?: number | null
        }
        Update: {
          auto_close_day?: number | null
          confirmation_window_days?: number | null
          max_active_reports_per_citizen?: number | null
          max_photos_per_cycle?: number | null
          nudge_day?: number | null
          sla_hours_critical?: number | null
          sla_hours_high?: number | null
          sla_hours_low?: number | null
          sla_hours_medium?: number | null
        }
        Relationships: []
      }
      public_incident_types: {
        Row: {
          base_level: Database["public"]["Enums"]["incident_level"] | null
          category_code: string | null
          code: string | null
          default_department_code: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          base_level?: Database["public"]["Enums"]["incident_level"] | null
          category_code?: string | null
          code?: string | null
          default_department_code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          base_level?: Database["public"]["Enums"]["incident_level"] | null
          category_code?: string | null
          code?: string | null
          default_department_code?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      public_places: {
        Row: {
          address: string | null
          badge: string | null
          description: string | null
          id: string | null
          image_path: string | null
          maps_query: string | null
          name: string | null
          section: Database["public"]["Enums"]["poi_section"] | null
          sort_order: number | null
        }
        Insert: {
          address?: string | null
          badge?: string | null
          description?: string | null
          id?: string | null
          image_path?: string | null
          maps_query?: string | null
          name?: string | null
          section?: Database["public"]["Enums"]["poi_section"] | null
          sort_order?: number | null
        }
        Update: {
          address?: string | null
          badge?: string | null
          description?: string | null
          id?: string | null
          image_path?: string | null
          maps_query?: string | null
          name?: string | null
          section?: Database["public"]["Enums"]["poi_section"] | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_post_categories: {
        Row: {
          code: string | null
          color_hex: string | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          color_hex?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          color_hex?: string | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      public_posts: {
        Row: {
          body: string | null
          category_code: string | null
          category_label: string | null
          color_hex: string | null
          content_type: Database["public"]["Enums"]["content_type"] | null
          id: string | null
          image_path: string | null
          published_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "platform_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "super_post_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      public_site_info: {
        Row: {
          agency_name: string | null
          office_hours: string | null
          seal_path: string | null
          trunkline: string | null
        }
        Insert: {
          agency_name?: string | null
          office_hours?: string | null
          seal_path?: string | null
          trunkline?: string | null
        }
        Update: {
          agency_name?: string | null
          office_hours?: string | null
          seal_path?: string | null
          trunkline?: string | null
        }
        Relationships: []
      }
      public_site_info_entries: {
        Row: {
          kind: Database["public"]["Enums"]["site_info_kind"] | null
          label: string | null
          sort_order: number | null
          value: string | null
        }
        Insert: {
          kind?: Database["public"]["Enums"]["site_info_kind"] | null
          label?: string | null
          sort_order?: number | null
          value?: string | null
        }
        Update: {
          kind?: Database["public"]["Enums"]["site_info_kind"] | null
          label?: string | null
          sort_order?: number | null
          value?: string | null
        }
        Relationships: []
      }
      public_venue_availability: {
        Row: {
          during: unknown
          event_date: string | null
          space_code: string | null
          venue_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_occupancies_space_code_fkey"
            columns: ["space_code"]
            isOneToOne: false
            referencedRelation: "booking_venue_spaces"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_space_map_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_space_map_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "booking_venue_space_map_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      public_yellow_card_categories: {
        Row: {
          code: string | null
          is_default: boolean | null
          label: string | null
        }
        Insert: {
          code?: string | null
          is_default?: boolean | null
          label?: string | null
        }
        Update: {
          code?: string | null
          is_default?: boolean | null
          label?: string | null
        }
        Relationships: []
      }
      public_yellow_card_classifications: {
        Row: {
          code: string | null
          is_default: boolean | null
          label: string | null
        }
        Insert: {
          code?: string | null
          is_default?: boolean | null
          label?: string | null
        }
        Update: {
          code?: string | null
          is_default?: boolean | null
          label?: string | null
        }
        Relationships: []
      }
      public_yellow_card_config: {
        Row: {
          processing_time_target_days: number | null
        }
        Insert: {
          processing_time_target_days?: number | null
        }
        Update: {
          processing_time_target_days?: number | null
        }
        Relationships: []
      }
      public_yellow_card_document_types: {
        Row: {
          code: string | null
          is_required: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          is_required?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          is_required?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      responder_department_duty: {
        Row: {
          department_code: string | null
          department_label: string | null
          on_duty_count: number | null
          total_count: number | null
        }
        Relationships: []
      }
      responder_history: {
        Row: {
          address: string | null
          assigned_department_code: string | null
          barangay_name: string | null
          category_label: string | null
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          description: string | null
          id: string | null
          incident_level: Database["public"]["Enums"]["incident_level"] | null
          incident_type_code: string | null
          is_verified: boolean | null
          my_last_outcome:
            | Database["public"]["Enums"]["incident_event_type"]
            | null
          my_last_outcome_at: string | null
          reference_number: string | null
          reopened_count: number | null
          resolved_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"] | null
          submitted_at: string | null
          type_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "public_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "super_incident_types"
            referencedColumns: ["code"]
          },
        ]
      }
      responder_incident_events: {
        Row: {
          actor_name: string | null
          actor_role: Database["public"]["Enums"]["actor_role"] | null
          created_at: string | null
          cycle_number: number | null
          event_type: Database["public"]["Enums"]["incident_event_type"] | null
          id: string | null
          incident_id: string | null
          note: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      responder_incident_photos: {
        Row: {
          cycle_number: number | null
          id: string | null
          incident_id: string | null
          kind: Database["public"]["Enums"]["photo_kind"] | null
          mime_type: string | null
          size_bytes: number | null
          uploaded_at: string | null
          uploaded_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      responder_incidents: {
        Row: {
          address: string | null
          after_photo_count: number | null
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_name: string | null
          before_photo_count: number | null
          category_label: string | null
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          cycle_number: number | null
          description: string | null
          id: string | null
          incident_level: Database["public"]["Enums"]["incident_level"] | null
          incident_type_code: string | null
          is_verified: boolean | null
          pooled_at: string | null
          reference_number: string | null
          reporter_first_name: string | null
          reporter_phone: string | null
          resolved_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["incident_status"] | null
          submitted_at: string | null
          type_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "public_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "super_incident_types"
            referencedColumns: ["code"]
          },
        ]
      }
      staff_booking_documents: {
        Row: {
          booking_id: string | null
          id: string | null
          kind: Database["public"]["Enums"]["booking_doc_kind"] | null
          mime_type: string | null
          payment_id: string | null
          reference_number: string | null
          size_bytes: number | null
          superseded_by: string | null
          uploaded_at: string | null
          verified_at: string | null
          verified_by: string | null
          verified_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "booking_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "staff_booking_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "booking_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "staff_booking_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_booking_events: {
        Row: {
          actor_name: string | null
          actor_role: Database["public"]["Enums"]["actor_role"] | null
          booking_id: string | null
          created_at: string | null
          event_type: string | null
          id: string | null
          note: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_booking_payments: {
        Row: {
          amount: number | null
          booking_id: string | null
          citizen_id: string | null
          gcash_reference: string | null
          id: string | null
          kind: Database["public"]["Enums"]["payment_kind"] | null
          method: Database["public"]["Enums"]["payment_method"] | null
          official_receipt_no: string | null
          paid_at: string | null
          receipt_document_id: string | null
          recorded_by: string | null
          recorded_by_name: string | null
          reference_number: string | null
          rejected_reason: string | null
          submitted_at: string | null
          verified_at: string | null
          verified_by: string | null
          verified_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "admin_booking_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "my_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "staff_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "citizens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_bookings: {
        Row: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          classification_code: string | null
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string | null
          contact_person: string | null
          document_count: number | null
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number | null
          email_address: string | null
          estimated_headcount: number | null
          event_date: string | null
          event_title: string | null
          event_type_code: string | null
          event_type_label: string | null
          hold_expires_at: string | null
          id: string | null
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          payment_count: number | null
          quoted_at: string | null
          quoted_by: string | null
          quoted_by_name: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"] | null
          reference_number: string | null
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          submitted_at: string | null
          terms_accepted_at: string | null
          tier_review_look: number | null
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean | null
          total_fee: number | null
          unverified_payment_count: number | null
          venue_code: string | null
          venue_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "public_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_classification_code_fkey"
            columns: ["classification_code"]
            isOneToOne: false
            referencedRelation: "super_booking_classifications"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "public_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_event_type_code_fkey"
            columns: ["event_type_code"]
            isOneToOne: false
            referencedRelation: "super_booking_event_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_origin_barangay_code_fkey"
            columns: ["origin_barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_origin_barangay_code_fkey"
            columns: ["origin_barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_quoted_by_fkey"
            columns: ["quoted_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quoted_by_fkey"
            columns: ["quoted_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quoted_by_fkey"
            columns: ["quoted_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rehearsal_rate_type_fkey"
            columns: ["rehearsal_rate_type"]
            isOneToOne: false
            referencedRelation: "booking_rehearsal_rates"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_rehearsal_rate_type_fkey"
            columns: ["rehearsal_rate_type"]
            isOneToOne: false
            referencedRelation: "public_booking_rehearsal_rates"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "public_booking_venues"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_venue_code_fkey"
            columns: ["venue_code"]
            isOneToOne: false
            referencedRelation: "super_booking_venues"
            referencedColumns: ["code"]
          },
        ]
      }
      staff_incident_config: {
        Row: {
          at_risk_threshold_pct: number | null
        }
        Insert: {
          at_risk_threshold_pct?: number | null
        }
        Update: {
          at_risk_threshold_pct?: number | null
        }
        Relationships: []
      }
      staff_incident_events: {
        Row: {
          actor_name: string | null
          actor_role: Database["public"]["Enums"]["actor_role"] | null
          created_at: string | null
          cycle_number: number | null
          event_type: Database["public"]["Enums"]["incident_event_type"] | null
          id: string | null
          incident_id: string | null
          note: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_incident_photos: {
        Row: {
          cycle_number: number | null
          id: string | null
          incident_id: string | null
          kind: Database["public"]["Enums"]["photo_kind"] | null
          mime_type: string | null
          size_bytes: number | null
          uploaded_at: string | null
          uploaded_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_incidents: {
        Row: {
          address: string | null
          assigned_department_code: string | null
          assigned_responder_id: string | null
          assigned_responder_name: string | null
          barangay_code: string | null
          barangay_name: string | null
          category_code: string | null
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          description: string | null
          duplicate_of: string | null
          id: string | null
          incident_level: Database["public"]["Enums"]["incident_level"] | null
          incident_type_code: string | null
          is_anonymous: boolean | null
          is_verified: boolean | null
          original_reference: string | null
          photo_count: number | null
          reference_number: string | null
          reopened_count: number | null
          reporter_first_name: string | null
          reporter_phone: string | null
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"] | null
          submitted_at: string | null
          suggested_department_code: string | null
          type_label: string | null
          verified_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_assigned_department_code_fkey"
            columns: ["assigned_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_responder_id_fkey"
            columns: ["assigned_responder_id"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "admin_incident_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "my_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "responder_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "responder_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "staff_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "public_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_incident_type_code_fkey"
            columns: ["incident_type_code"]
            isOneToOne: false
            referencedRelation: "super_incident_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incidents_suggested_department_code_fkey"
            columns: ["suggested_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      staff_yellow_card_documents: {
        Row: {
          application_id: string | null
          byte_size: number | null
          document_type_code: string | null
          document_type_label: string | null
          id: string | null
          mime_type: string | null
          original_filename: string | null
          superseded_by: string | null
          uploaded_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_document_type_code_fkey"
            columns: ["document_type_code"]
            isOneToOne: false
            referencedRelation: "public_yellow_card_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_documents_document_type_code_fkey"
            columns: ["document_type_code"]
            isOneToOne: false
            referencedRelation: "super_yellow_card_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_documents_document_type_code_fkey"
            columns: ["document_type_code"]
            isOneToOne: false
            referencedRelation: "yellow_card_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "yellow_card_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_yellow_card_queue: {
        Row: {
          barangay_code: string | null
          barangay_name: string | null
          civil_status_code: string | null
          complete_address: string | null
          contact_number: string | null
          current_review_id: string | null
          date_of_birth: string | null
          deadline_state: string | null
          decided_at: string | null
          document_count: number | null
          due_at: string | null
          email_address: string | null
          first_name: string | null
          gender_code: string | null
          id: string | null
          last_name: string | null
          middle_name: string | null
          needs_dedup_review: boolean | null
          privacy_consent: boolean | null
          reference_number: string | null
          review_cycles: number | null
          sla_clock_started_at: string | null
          sla_elapsed_seconds: number | null
          sla_target_hours: number | null
          status:
            | Database["public"]["Enums"]["yellow_card_application_status"]
            | null
          submitted_at: string | null
          suffix: string | null
          voter_id_number: string | null
          years_of_residency: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_review"
            columns: ["current_review_id"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_current_review"
            columns: ["current_review_id"]
            isOneToOne: false
            referencedRelation: "yellow_card_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "public_barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_civil_status_code_fkey"
            columns: ["civil_status_code"]
            isOneToOne: false
            referencedRelation: "civil_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_civil_status_code_fkey"
            columns: ["civil_status_code"]
            isOneToOne: false
            referencedRelation: "public_civil_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "genders"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "yellow_card_applications_gender_code_fkey"
            columns: ["gender_code"]
            isOneToOne: false
            referencedRelation: "public_genders"
            referencedColumns: ["code"]
          },
        ]
      }
      staff_yellow_card_reviews: {
        Row: {
          application_id: string | null
          decision: Database["public"]["Enums"]["yellow_card_decision"] | null
          id: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "admin_yellow_card_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "my_yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "staff_yellow_card_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "yellow_card_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yellow_card_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_accounts: {
        Row: {
          created_at: string | null
          department_code: string | null
          department_label: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string | null
          invited_at: string | null
          is_supervisor: boolean | null
          last_change_at: string | null
          last_sign_in_at: string | null
          modules: Database["public"]["Enums"]["module_code"][] | null
          on_duty: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"] | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "staff_accounts_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      super_audit_log: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          area: Database["public"]["Enums"]["audit_area"] | null
          change: string | null
          changes: Json | null
          detail: string | null
          id: string | null
          ip_address: unknown
          occurred_at: string | null
          session_id: string | null
          target_id: string | null
          target_kind: Database["public"]["Enums"]["audit_target_kind"] | null
          target_label: string | null
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          area?: Database["public"]["Enums"]["audit_area"] | null
          change?: string | null
          changes?: Json | null
          detail?: string | null
          id?: string | null
          ip_address?: unknown
          occurred_at?: string | null
          session_id?: string | null
          target_id?: string | null
          target_kind?: Database["public"]["Enums"]["audit_target_kind"] | null
          target_label?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          area?: Database["public"]["Enums"]["audit_area"] | null
          change?: string | null
          changes?: Json | null
          detail?: string | null
          id?: string | null
          ip_address?: unknown
          occurred_at?: string | null
          session_id?: string | null
          target_id?: string | null
          target_kind?: Database["public"]["Enums"]["audit_target_kind"] | null
          target_label?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_booking_classifications: {
        Row: {
          code: string | null
          is_discount_eligible: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          is_discount_eligible?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          is_discount_eligible?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      super_booking_config: {
        Row: {
          balance_due_days_before_event: number | null
          closing_hour: number | null
          downpayment_pct: number | null
          min_duration_hours: number | null
          opening_hour: number | null
          payment_window_hours: number | null
          updated_at: string | null
        }
        Insert: {
          balance_due_days_before_event?: number | null
          closing_hour?: number | null
          downpayment_pct?: number | null
          min_duration_hours?: number | null
          opening_hour?: number | null
          payment_window_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          balance_due_days_before_event?: number | null
          closing_hour?: number | null
          downpayment_pct?: number | null
          min_duration_hours?: number | null
          opening_hour?: number | null
          payment_window_hours?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_booking_event_types: {
        Row: {
          code: string | null
          is_active: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      super_booking_venues: {
        Row: {
          capacity_label: string | null
          code: string | null
          is_active: boolean | null
          is_hourly: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          capacity_label?: string | null
          code?: string | null
          is_active?: boolean | null
          is_hourly?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          capacity_label?: string | null
          code?: string | null
          is_active?: boolean | null
          is_hourly?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      super_contact_messages: {
        Row: {
          created_at: string | null
          email: string | null
          handled_at: string | null
          handled_by: string | null
          handled_by_name: string | null
          id: string | null
          message: string | null
          name: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_content: {
        Row: {
          body: string | null
          category_code: string | null
          category_label: string | null
          color_hex: string | null
          content_type: Database["public"]["Enums"]["content_type"] | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          end_at: string | null
          id: string | null
          image_path: string | null
          is_published: boolean | null
          start_at: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "platform_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "super_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_departments: {
        Row: {
          code: string | null
          is_active: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      super_events: {
        Row: {
          category_code: string | null
          category_label: string | null
          color_hex: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          end_at: string | null
          id: string | null
          image_path: string | null
          is_published: boolean | null
          location_text: string | null
          start_at: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "platform_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "super_post_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "platform_city_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_city_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_city_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_holidays: {
        Row: {
          calendar_ends_on: string | null
          created_at: string | null
          created_by: string | null
          holiday_date: string | null
          id: string | null
          is_active: boolean | null
          kind: Database["public"]["Enums"]["holiday_kind"] | null
          name: string | null
          source: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_incident_config: {
        Row: {
          at_risk_threshold_pct: number | null
          auto_close_day: number | null
          confirmation_window_days: number | null
          max_active_reports_per_citizen: number | null
          max_photos_per_cycle: number | null
          nudge_day: number | null
          sla_hours_critical: number | null
          sla_hours_high: number | null
          sla_hours_low: number | null
          sla_hours_medium: number | null
          updated_at: string | null
        }
        Insert: {
          at_risk_threshold_pct?: number | null
          auto_close_day?: number | null
          confirmation_window_days?: number | null
          max_active_reports_per_citizen?: number | null
          max_photos_per_cycle?: number | null
          nudge_day?: number | null
          sla_hours_critical?: number | null
          sla_hours_high?: number | null
          sla_hours_low?: number | null
          sla_hours_medium?: number | null
          updated_at?: string | null
        }
        Update: {
          at_risk_threshold_pct?: number | null
          auto_close_day?: number | null
          confirmation_window_days?: number | null
          max_active_reports_per_citizen?: number | null
          max_photos_per_cycle?: number | null
          nudge_day?: number | null
          sla_hours_critical?: number | null
          sla_hours_high?: number | null
          sla_hours_low?: number | null
          sla_hours_medium?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_incident_types: {
        Row: {
          base_level: Database["public"]["Enums"]["incident_level"] | null
          category_code: string | null
          code: string | null
          default_department_code: string | null
          is_active: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          base_level?: Database["public"]["Enums"]["incident_level"] | null
          category_code?: string | null
          code?: string | null
          default_department_code?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          base_level?: Database["public"]["Enums"]["incident_level"] | null
          category_code?: string | null
          code?: string | null
          default_department_code?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "public_incident_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "public_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "responder_department_duty"
            referencedColumns: ["department_code"]
          },
          {
            foreignKeyName: "incident_types_default_department_code_fkey"
            columns: ["default_department_code"]
            isOneToOne: false
            referencedRelation: "super_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      super_metrics: {
        Row: {
          at_risk_now: number | null
          at_risk_prev: number | null
          bookings_7d: number | null
          bookings_7d_prev: number | null
          open_backlog: number | null
          open_backlog_prev: number | null
          sla_compliance_pct: number | null
          sla_compliance_pct_prev: number | null
        }
        Relationships: []
      }
      super_office_hours: {
        Row: {
          close_time: string | null
          day_name: string | null
          is_working_day: boolean | null
          iso_weekday: number | null
          open_time: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          close_time?: string | null
          day_name?: never
          is_working_day?: never
          iso_weekday?: number | null
          open_time?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          close_time?: string | null
          day_name?: never
          is_working_day?: never
          iso_weekday?: number | null
          open_time?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "my_staff_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "super_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_officers_of_record: {
        Row: {
          designation: string | null
          full_name: string | null
          is_placeholder: boolean | null
          service: Database["public"]["Enums"]["module_code"] | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          designation?: string | null
          full_name?: string | null
          is_placeholder?: boolean | null
          service?: Database["public"]["Enums"]["module_code"] | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          designation?: string | null
          full_name?: string | null
          is_placeholder?: boolean | null
          service?: Database["public"]["Enums"]["module_code"] | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_places: {
        Row: {
          address: string | null
          badge: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_path: string | null
          is_published: boolean | null
          maps_query: string | null
          name: string | null
          section: Database["public"]["Enums"]["poi_section"] | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          badge?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_path?: string | null
          is_published?: boolean | null
          maps_query?: string | null
          name?: string | null
          section?: Database["public"]["Enums"]["poi_section"] | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          badge?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_path?: string | null
          is_published?: boolean | null
          maps_query?: string | null
          name?: string | null
          section?: Database["public"]["Enums"]["poi_section"] | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_post_categories: {
        Row: {
          code: string | null
          color_hex: string | null
          is_active: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          color_hex?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          color_hex?: string | null
          is_active?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      super_site_info: {
        Row: {
          agency_name: string | null
          office_hours: string | null
          seal_path: string | null
          trunkline: string | null
          updated_at: string | null
        }
        Insert: {
          agency_name?: string | null
          office_hours?: string | null
          seal_path?: string | null
          trunkline?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_name?: string | null
          office_hours?: string | null
          seal_path?: string | null
          trunkline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_site_info_entries: {
        Row: {
          id: string | null
          is_active: boolean | null
          kind: Database["public"]["Enums"]["site_info_kind"] | null
          label: string | null
          sort_order: number | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string | null
          is_active?: boolean | null
          kind?: Database["public"]["Enums"]["site_info_kind"] | null
          label?: string | null
          sort_order?: number | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string | null
          is_active?: boolean | null
          kind?: Database["public"]["Enums"]["site_info_kind"] | null
          label?: string | null
          sort_order?: number | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      super_system_health_samples: {
        Row: {
          accounts_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          connections: number | null
          database_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          db_bytes: number | null
          email_bounced_24h: number | null
          email_failed_24h: number | null
          email_oldest_queued_seconds: number | null
          email_queued: number | null
          incidents_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          jobs_failed_24h: number | null
          jobs_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          lcc_status: Database["public"]["Enums"]["system_health_status"] | null
          notifications_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          push_bounced_24h: number | null
          push_failed_24h: number | null
          push_oldest_queued_seconds: number | null
          push_queued: number | null
          sampled_at: string | null
          status: Database["public"]["Enums"]["system_health_status"] | null
          storage_bytes: number | null
          storage_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          yellow_card_status:
            | Database["public"]["Enums"]["system_health_status"]
            | null
        }
        Insert: {
          accounts_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          connections?: number | null
          database_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          db_bytes?: number | null
          email_bounced_24h?: number | null
          email_failed_24h?: number | null
          email_oldest_queued_seconds?: number | null
          email_queued?: number | null
          incidents_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          jobs_failed_24h?: number | null
          jobs_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          lcc_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          notifications_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          push_bounced_24h?: number | null
          push_failed_24h?: number | null
          push_oldest_queued_seconds?: number | null
          push_queued?: number | null
          sampled_at?: string | null
          status?: Database["public"]["Enums"]["system_health_status"] | null
          storage_bytes?: number | null
          storage_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          yellow_card_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
        }
        Update: {
          accounts_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          connections?: number | null
          database_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          db_bytes?: number | null
          email_bounced_24h?: number | null
          email_failed_24h?: number | null
          email_oldest_queued_seconds?: number | null
          email_queued?: number | null
          incidents_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          jobs_failed_24h?: number | null
          jobs_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          lcc_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          notifications_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          push_bounced_24h?: number | null
          push_failed_24h?: number | null
          push_oldest_queued_seconds?: number | null
          push_queued?: number | null
          sampled_at?: string | null
          status?: Database["public"]["Enums"]["system_health_status"] | null
          storage_bytes?: number | null
          storage_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
          yellow_card_status?:
            | Database["public"]["Enums"]["system_health_status"]
            | null
        }
        Relationships: []
      }
      super_system_health_summary: {
        Row: {
          healthy_pct_24h: number | null
          healthy_pct_7d: number | null
          ok_24h: number | null
          ok_7d: number | null
          samples_24h: number | null
          samples_7d: number | null
        }
        Relationships: []
      }
      super_yellow_card_config: {
        Row: {
          at_risk_threshold_pct: number | null
          processing_time_target_days: number | null
          updated_at: string | null
        }
        Insert: {
          at_risk_threshold_pct?: number | null
          processing_time_target_days?: number | null
          updated_at?: string | null
        }
        Update: {
          at_risk_threshold_pct?: number | null
          processing_time_target_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_yellow_card_document_types: {
        Row: {
          code: string | null
          is_active: boolean | null
          is_required: boolean | null
          label: string | null
          sort_order: number | null
        }
        Insert: {
          code?: string | null
          is_active?: boolean | null
          is_required?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string | null
          is_active?: boolean | null
          is_required?: boolean | null
          label?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_holiday: {
        Args: {
          p_holiday_date: string
          p_kind: Database["public"]["Enums"]["holiday_kind"]
          p_name: string
          p_source: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["holiday_kind"]
          name: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "holidays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_incident_note: {
        Args: { p_incident_id: string; p_note: string }
        Returns: {
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_user_id: string | null
          created_at: string
          cycle_number: number
          event_type: Database["public"]["Enums"]["incident_event_type"]
          id: string
          incident_id: string
          note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incident_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_incident_stage: {
        Args: {
          p_incident_id: string
          p_stage: Database["public"]["Enums"]["incident_event_type"]
        }
        Returns: {
          actor_role: Database["public"]["Enums"]["actor_role"]
          actor_user_id: string | null
          created_at: string
          cycle_number: number
          event_type: Database["public"]["Enums"]["incident_event_type"]
          id: string
          incident_id: string
          note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incident_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      anonymise_citizen: { Args: { p_citizen_id: string }; Returns: undefined }
      booking_hold_lapsed: {
        Args: {
          p_at: string
          p_hold_expires_at: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      booking_money: {
        Args: { p_total_fee: number }
        Returns: {
          balance_amount: number
          downpayment_amount: number
          downpayment_pct: number
        }[]
      }
      booking_price: {
        Args: {
          p_duration_hours: number
          p_rehearsal_rate_type: string
          p_tier: Database["public"]["Enums"]["rate_tier"]
          p_venue_code: string
        }
        Returns: {
          requires_quote: boolean
          total_fee: number
        }[]
      }
      booking_status_holds_dates: {
        Args: { p_status: Database["public"]["Enums"]["booking_status"] }
        Returns: boolean
      }
      can_read_booking_document: { Args: { p_path: string }; Returns: boolean }
      can_read_incident_photo: { Args: { p_path: string }; Returns: boolean }
      can_read_yc_document: { Args: { p_path: string }; Returns: boolean }
      can_write_booking_document: { Args: { p_path: string }; Returns: boolean }
      can_write_incident_photo: { Args: { p_path: string }; Returns: boolean }
      can_write_yc_document: { Args: { p_path: string }; Returns: boolean }
      cancel_booking: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_email_batch: {
        Args: { p_limit: number }
        Returns: {
          attempt: number
          message: string
          notification_id: string
          recipient_email: string
          subject: string
        }[]
      }
      claim_incident: {
        Args: { p_incident_id: string }
        Returns: {
          held_reference: string
          incident_id: string
          outcome: string
          winner_full_name: string
        }[]
      }
      claim_push_batch: {
        Args: { p_limit: number }
        Returns: {
          attempt: number
          devices: Json
          message: string
          notification_id: string
          subject: string
          target_id: string
        }[]
      }
      complete_booking: {
        Args: { p_booking_id: string }
        Returns: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_incident_resolution: {
        Args: { p_incident_id: string }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_upload: {
        Args: {
          p_kind: string
          p_mime_type: string
          p_row_id: string
          p_size_bytes: number
        }
        Returns: boolean
      }
      create_citizen_profile: {
        Args: {
          p_barangay_code?: string
          p_birth_date: string
          p_first_name: string
          p_gender_code: string
          p_house_no?: string
          p_last_name: string
          p_middle_name?: string
          p_mobile?: string
          p_occupation?: string
          p_street?: string
          p_suffix?: string
          p_terms_accepted?: boolean
          p_works_in_lucena?: boolean
        }
        Returns: {
          anonymised_at: string | null
          barangay_code: string | null
          birth_date: string
          created_at: string
          email: string
          first_name: string
          gender_code: string
          house_no: string | null
          id: string
          last_name: string
          middle_name: string | null
          mobile: string | null
          occupation: string | null
          street: string | null
          suffix: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          works_in_lucena: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "citizens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_event: {
        Args: {
          p_category_code?: string
          p_description?: string
          p_end_at?: string
          p_image_path?: string
          p_is_published?: boolean
          p_location_text: string
          p_start_at: string
          p_title: string
        }
        Returns: {
          category_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          image_path: string | null
          is_published: boolean
          location_text: string
          start_at: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_city_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_place: {
        Args: {
          p_address?: string
          p_badge?: string
          p_description: string
          p_image_path?: string
          p_is_published?: boolean
          p_maps_query?: string
          p_name: string
          p_section: Database["public"]["Enums"]["poi_section"]
        }
        Returns: {
          address: string | null
          badge: string | null
          created_at: string
          description: string
          id: string
          image_path: string | null
          is_published: boolean
          maps_query: string | null
          name: string
          section: Database["public"]["Enums"]["poi_section"]
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_points_of_interest"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_post: {
        Args: {
          p_body: string
          p_category_code: string
          p_content_type: Database["public"]["Enums"]["content_type"]
          p_end_at?: string
          p_image_path?: string
          p_is_published?: boolean
          p_start_at?: string
          p_title: string
        }
        Returns: {
          body: string
          category_code: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          created_by: string | null
          end_at: string | null
          id: string
          image_path: string | null
          is_published: boolean
          start_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_account_profile: {
        Args: {
          p_department_code?: string
          p_email: string
          p_employee_id?: string
          p_full_name: string
          p_id: string
          p_is_supervisor?: boolean
          p_modules?: Database["public"]["Enums"]["module_code"][]
          p_phone?: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: {
          created_at: string
          department_code: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_supervisor: boolean
          last_change_at: string
          modules: Database["public"]["Enums"]["module_code"][]
          on_duty: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cron_interval_seconds: { Args: { p_schedule: string }; Returns: number }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_my_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      email_delivery_enabled: { Args: never; Returns: boolean }
      email_worker_authorised: { Args: { p_secret: string }; Returns: boolean }
      export_yellow_card_applications: {
        Args: {
          p_date_basis?: string
          p_from?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          barangay_label: string
          email: string
          full_name: string
          reference: string
          status: string
          submitted_on: string
        }[]
      }
      force_release_incident: {
        Args: { p_incident_id: string; p_reason: string }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_document_path: {
        Args: { p_kind: string; p_row_id: string }
        Returns: {
          bucket: string
          path: string
        }[]
      }
      give_up_tier_claim: {
        Args: { p_booking_id: string }
        Returns: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_module: {
        Args: { p_module: Database["public"]["Enums"]["module_code"] }
        Returns: boolean
      }
      incident_photo_reservation_is_live: {
        Args: { p_reserved_at: string }
        Returns: boolean
      }
      is_active_staff: { Args: { p_role?: string }; Returns: boolean }
      jwt_department: { Args: never; Returns: string }
      jwt_role: { Args: never; Returns: string }
      log_staff_account_link_resent: {
        Args: { p_id: string }
        Returns: undefined
      }
      mark_contact_message_handled: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at: string
          error: string | null
          event_code: string
          id: string
          is_mocked: boolean
          module_code: Database["public"]["Enums"]["module_code"]
          next_attempt_at: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient_user_id: string
          record_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notify_status"]
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_reference: { Args: { p_prefix: string }; Returns: string }
      notification_reason_category: {
        Args: {
          p_error: string
          p_status: Database["public"]["Enums"]["notify_status"]
        }
        Returns: string
      }
      notify_citizen: {
        Args: {
          p_body: string
          p_event_code: string
          p_module: Database["public"]["Enums"]["module_code"]
          p_recipient: string
          p_record_id: string
          p_title: string
        }
        Returns: undefined
      }
      notify_staff: {
        Args: {
          p_body: string
          p_event_code: string
          p_module: Database["public"]["Enums"]["module_code"]
          p_recipient: string
          p_record_id: string
          p_title: string
        }
        Returns: undefined
      }
      post_status: {
        Args: { p_end_at: string; p_is_published: boolean; p_start_at: string }
        Returns: string
      }
      purge_cron_history: { Args: never; Returns: number }
      push_delivery_enabled: { Args: never; Returns: boolean }
      push_endpoint_allowed: { Args: { p_endpoint: string }; Returns: boolean }
      push_worker_authorised: { Args: { p_secret: string }; Returns: boolean }
      quote_booking: {
        Args: { p_booking_id: string; p_total_fee: number }
        Returns: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      read_booking_pii: {
        Args: { p_booking_id: string }
        Returns: {
          contact_number: string
          contact_person: string
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          organization_name: string
          reference: string
          special_requirements: string
          start_time: string
          status: string
          submitted_at: string
          total_fee: number
          venue_code: string
          venue_label: string
        }[]
      }
      read_incident_pii: {
        Args: { p_incident_id: string }
        Returns: {
          address: string
          assigned_department_code: string
          assigned_department_label: string
          barangay_code: string
          barangay_name: string
          description: string
          incident_level: string
          incident_type_code: string
          incident_type_label: string
          is_anonymous: boolean
          reference: string
          reporter_contact_number: string
          reporter_email: string
          reporter_first_name: string
          reporter_last_name: string
          reporter_middle_name: string
          status: string
          submitted_at: string
        }[]
      }
      read_yellow_card_application_pii: {
        Args: { p_application_id: string }
        Returns: {
          barangay_code: string
          barangay_name: string
          civil_status_code: string
          complete_address: string
          contact_number: string
          date_of_birth: string
          email_address: string
          first_name: string
          gender_code: string
          last_name: string
          middle_name: string
          reference: string
          status: string
          submitted_at: string
          suffix: string
          voter_id_number: string
          years_of_residency: number
        }[]
      }
      recompute_yellow_card_deadlines: { Args: never; Returns: number }
      record_balance_payment: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_official_receipt_no: string
          p_paid_at?: string
        }
        Returns: {
          amount: number
          booking_id: string
          gcash_reference: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          official_receipt_no: string | null
          paid_at: string | null
          recorded_by: string | null
          rejected_reason: string | null
          submitted_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "booking_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_email_bounce: {
        Args: {
          p_event: string
          p_message_id: string
          p_reason: string
          p_secret: string
        }
        Returns: boolean
      }
      record_email_result: {
        Args: {
          p_attempt: number
          p_error: string
          p_notification_id: string
          p_permanent: boolean
          p_provider_message_id: string
          p_sent: boolean
        }
        Returns: undefined
      }
      record_push_result: {
        Args: {
          p_attempt: number
          p_error: string
          p_gone_endpoints: string[]
          p_notification_id: string
          p_permanent: boolean
          p_sent: boolean
        }
        Returns: undefined
      }
      refuse_incident: {
        Args: {
          p_closure_reason: Database["public"]["Enums"]["closure_reason"]
          p_incident_id: string
          p_original_reference: string
          p_reason: string
        }
        Returns: {
          address: string | null
          assigned_department_code: string | null
          assigned_responder_id: string | null
          assigned_responder_name: string | null
          barangay_code: string | null
          barangay_name: string | null
          category_code: string | null
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          description: string | null
          duplicate_of: string | null
          id: string | null
          incident_level: Database["public"]["Enums"]["incident_level"] | null
          incident_type_code: string | null
          is_anonymous: boolean | null
          is_verified: boolean | null
          original_reference: string | null
          photo_count: number | null
          reference_number: string | null
          reopened_count: number | null
          reporter_first_name: string | null
          reporter_phone: string | null
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"] | null
          submitted_at: string | null
          suggested_department_code: string | null
          type_label: string | null
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "staff_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent: string
        }
        Returns: string
      }
      reject_booking: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_incident: {
        Args: { p_incident_id: string; p_reason: string }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_incident: {
        Args: { p_incident_id: string; p_reason: string }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_incident: {
        Args: { p_incident_id: string; p_reason: string }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reorder_places: {
        Args: {
          p_ids: string[]
          p_section: Database["public"]["Enums"]["poi_section"]
        }
        Returns: {
          address: string | null
          badge: string | null
          created_at: string
          description: string
          id: string
          image_path: string | null
          is_published: boolean
          maps_query: string | null
          name: string
          section: Database["public"]["Enums"]["poi_section"]
          sort_order: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_points_of_interest"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      request_booking_document_upload: {
        Args: {
          p_booking_id: string
          p_ext: string
          p_kind: Database["public"]["Enums"]["booking_doc_kind"]
          p_payment_id?: string
        }
        Returns: {
          bucket: string
          row_id: string
          storage_path: string
        }[]
      }
      request_incident_photo_upload: {
        Args: {
          p_ext: string
          p_incident_id: string
          p_kind: Database["public"]["Enums"]["photo_kind"]
        }
        Returns: {
          bucket: string
          row_id: string
          storage_path: string
        }[]
      }
      request_yellow_card_document_upload: {
        Args: {
          p_application_id: string
          p_document_type_code: string
          p_ext: string
        }
        Returns: {
          bucket: string
          row_id: string
          storage_path: string
        }[]
      }
      resolve_incident: {
        Args: { p_incident_id: string; p_note?: string }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_booking: {
        Args: {
          p_booking_id: string
          p_decision: Database["public"]["Enums"]["tier_review_decision"]
          p_reason?: string
        }
        Returns: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_yellow_card_application: {
        Args: {
          p_application_id: string
          p_decision: Database["public"]["Enums"]["yellow_card_decision"]
          p_reason?: string
        }
        Returns: {
          barangay_code: string
          citizen_id: string
          civil_status_code: string
          complete_address: string
          contact_number: string
          created_at: string
          current_review_id: string | null
          date_of_birth: string
          decided_at: string | null
          due_at: string | null
          email_address: string
          first_name: string
          gender_code: string
          id: string
          last_name: string
          middle_name: string | null
          needs_dedup_review: boolean
          privacy_consent: boolean
          reference_number: string
          sla_clock_started_at: string | null
          sla_elapsed_seconds: number
          sla_target_hours: number
          status: Database["public"]["Enums"]["yellow_card_application_status"]
          submitted_at: string
          suffix: string | null
          updated_at: string
          voter_id_number: string
          voter_id_number_normalized: string | null
          years_of_residency: number
        }
        SetofOptions: {
          from: "*"
          to: "yellow_card_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      route_incident: {
        Args: {
          p_department_code: string
          p_incident_id: string
          p_level?: Database["public"]["Enums"]["incident_level"]
          p_note?: string
        }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sample_system_health: {
        Args: never
        Returns: Database["public"]["Enums"]["system_health_status"]
      }
      save_agency_identity: {
        Args: { p_agency_name: string; p_seal_path: string }
        Returns: {
          agency_name: string
          id: boolean
          office_hours: string
          seal_path: string
          trunkline: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "site_info"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_booking_config: {
        Args: {
          p_balance_due_days_before_event?: number
          p_closing_hour?: number
          p_downpayment_pct?: number
          p_min_duration_hours?: number
          p_opening_hour?: number
          p_payment_window_hours?: number
        }
        Returns: {
          balance_due_days_before_event: number
          closing_hour: number
          downpayment_pct: number
          id: boolean
          min_duration_hours: number
          opening_hour: number
          payment_window_hours: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "booking_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_incident_config: {
        Args: {
          p_at_risk_threshold_pct?: number
          p_auto_close_day?: number
          p_confirmation_window_days?: number
          p_max_active_reports_per_citizen?: number
          p_max_photos_per_cycle?: number
          p_nudge_day?: number
          p_sla_hours_critical?: number
          p_sla_hours_high?: number
          p_sla_hours_low?: number
          p_sla_hours_medium?: number
        }
        Returns: {
          at_risk_threshold_pct: number
          auto_close_day: number
          confirmation_window_days: number
          id: boolean
          max_active_reports_per_citizen: number
          max_photos_per_cycle: number
          nudge_day: number
          sla_hours_critical: number
          sla_hours_high: number
          sla_hours_low: number
          sla_hours_medium: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incident_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_site_info: {
        Args: { p_office_hours?: string; p_trunkline?: string }
        Returns: {
          agency_name: string
          id: boolean
          office_hours: string
          seal_path: string
          trunkline: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "site_info"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_yellow_card_config: {
        Args: {
          p_at_risk_threshold_pct?: number
          p_processing_time_target_days?: number
        }
        Returns: {
          at_risk_threshold_pct: number
          id: boolean
          processing_time_target_days: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "yellow_card_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_my_on_duty: {
        Args: { p_on_duty: boolean }
        Returns: {
          created_at: string
          department_code: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_supervisor: boolean
          last_change_at: string
          modules: Database["public"]["Enums"]["module_code"][]
          on_duty: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_office_hours: {
        Args: {
          p_close_time: string
          p_iso_weekday: number
          p_open_time: string
        }
        Returns: {
          close_time: string | null
          iso_weekday: number
          open_time: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "office_hours"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_post_published: {
        Args: { p_id: string; p_is_published: boolean }
        Returns: {
          body: string
          category_code: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          created_by: string | null
          end_at: string | null
          id: string
          image_path: string | null
          is_published: boolean
          start_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_staff_account_status: {
        Args: { p_id: string; p_reason: string; p_status: string }
        Returns: {
          created_at: string
          department_code: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_supervisor: boolean
          last_change_at: string
          modules: Database["public"]["Enums"]["module_code"][]
          on_duty: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_staff_on_duty: {
        Args: { p_id: string; p_on_duty: boolean }
        Returns: {
          created_at: string
          department_code: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_supervisor: boolean
          last_change_at: string
          modules: Database["public"]["Enums"]["module_code"][]
          on_duty: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_booking: {
        Args: {
          p_classification_code: string
          p_contact_number: string
          p_contact_person: string
          p_duration_hours: number
          p_email_address: string
          p_estimated_headcount: number
          p_event_date: string
          p_event_title: string
          p_event_type_code: string
          p_organization_name?: string
          p_rehearsal_rate_type?: string
          p_special_requirements?: string
          p_start_time: string
          p_venue_code: string
        }
        Returns: {
          balance_amount: number | null
          balance_settled_at: string | null
          cancellation_reason:
            | Database["public"]["Enums"]["booking_cancellation_reason"]
            | null
          citizen_id: string
          classification_code: string
          completed_at: string | null
          confirmed_at: string | null
          contact_number: string
          contact_person: string
          created_at: string
          downpayment_amount: number | null
          downpayment_pct: number | null
          duration_hours: number
          email_address: string
          estimated_headcount: number
          event_date: string
          event_title: string
          event_type_code: string
          hold_expires_at: string | null
          id: string
          is_resident: boolean | null
          organization_name: string | null
          origin_barangay_code: string | null
          origin_locality: string | null
          quoted_at: string | null
          quoted_by: string | null
          rate_tier: Database["public"]["Enums"]["rate_tier"]
          reference_number: string
          rehearsal_rate_type: string | null
          special_requirements: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          terms_accepted_at: string
          tier_review_since: string | null
          tier_revision_reason: string | null
          tier_verified: boolean
          total_fee: number | null
          updated_at: string
          venue_code: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_contact_message: {
        Args: { p_email: string; p_message: string; p_name: string }
        Returns: undefined
      }
      submit_downpayment: {
        Args: { p_booking_id: string; p_gcash_reference: string }
        Returns: {
          amount: number
          booking_id: string
          gcash_reference: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          official_receipt_no: string | null
          paid_at: string | null
          recorded_by: string | null
          rejected_reason: string | null
          submitted_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "booking_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_incident: {
        Args: {
          p_address: string
          p_barangay_code: string
          p_description: string
          p_incident_type_code: string
          p_is_anonymous?: boolean
        }
        Returns: {
          address: string
          assigned_department_code: string | null
          assigned_responder_id: string | null
          barangay_code: string
          citizen_id: string
          closed_at: string | null
          closure_reason: Database["public"]["Enums"]["closure_reason"] | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          incident_level: Database["public"]["Enums"]["incident_level"]
          incident_type_code: string
          is_anonymous: boolean
          is_verified: boolean
          pooled_at: string | null
          reference_number: string
          reopened_count: number
          resolved_at: string | null
          routed_at: string | null
          sla_armed_at: string | null
          sla_due_at: string | null
          sla_target_hours: number | null
          status: Database["public"]["Enums"]["incident_status"]
          submitted_at: string
          suggested_department_code: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_yellow_card_application: {
        Args: {
          p_barangay_code: string
          p_civil_status_code: string
          p_complete_address: string
          p_contact_number: string
          p_date_of_birth: string
          p_email_address: string
          p_first_name: string
          p_gender_code: string
          p_last_name: string
          p_middle_name?: string
          p_privacy_consent: boolean
          p_suffix?: string
          p_voter_id_number: string
          p_years_of_residency: number
        }
        Returns: {
          barangay_code: string
          citizen_id: string
          civil_status_code: string
          complete_address: string
          contact_number: string
          created_at: string
          current_review_id: string | null
          date_of_birth: string
          decided_at: string | null
          due_at: string | null
          email_address: string
          first_name: string
          gender_code: string
          id: string
          last_name: string
          middle_name: string | null
          needs_dedup_review: boolean
          privacy_consent: boolean
          reference_number: string
          sla_clock_started_at: string | null
          sla_elapsed_seconds: number
          sla_target_hours: number
          status: Database["public"]["Enums"]["yellow_card_application_status"]
          submitted_at: string
          suffix: string | null
          updated_at: string
          voter_id_number: string
          voter_id_number_normalized: string | null
          years_of_residency: number
        }
        SetofOptions: {
          from: "*"
          to: "yellow_card_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      super_system_health: { Args: never; Returns: Json }
      sweep_expired_holds: { Args: never; Returns: number }
      sweep_incident_lifecycle: { Args: never; Returns: number }
      sweep_send_email_queue: { Args: never; Returns: boolean }
      sweep_send_push_queue: { Args: never; Returns: boolean }
      sweep_yellow_card_deadline_notices: { Args: never; Returns: number }
      system_health_server_stats: { Args: never; Returns: Json }
      system_health_service_stats: {
        Args: {
          p_abandoned_upload_seconds: number
          p_hold_grace_seconds: number
          p_lifecycle_grace_seconds: number
          p_notice_grace_seconds: number
          p_receipt_grace_seconds: number
        }
        Returns: Json
      }
      system_health_snapshot: { Args: never; Returns: Json }
      update_booking_classification: {
        Args: {
          p_code: string
          p_is_discount_eligible: boolean
          p_sort_order: number
        }
        Returns: {
          code: string
          is_discount_eligible: boolean
          label: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "booking_classifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_booking_event_type: {
        Args: {
          p_code: string
          p_is_active: boolean
          p_label: string
          p_sort_order: number
        }
        Returns: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "booking_event_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_booking_venue: {
        Args: {
          p_capacity_label: string
          p_code: string
          p_is_active: boolean
          p_label: string
          p_sort_order: number
        }
        Returns: {
          capacity_label: string | null
          code: string
          is_active: boolean
          is_hourly: boolean
          label: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "booking_venues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_citizen_profile: {
        Args: {
          p_barangay_code?: string
          p_birth_date: string
          p_first_name: string
          p_gender_code: string
          p_house_no?: string
          p_last_name: string
          p_middle_name?: string
          p_mobile?: string
          p_occupation?: string
          p_street?: string
          p_suffix?: string
          p_works_in_lucena?: boolean
        }
        Returns: {
          anonymised_at: string | null
          barangay_code: string | null
          birth_date: string
          created_at: string
          email: string
          first_name: string
          gender_code: string
          house_no: string | null
          id: string
          last_name: string
          middle_name: string | null
          mobile: string | null
          occupation: string | null
          street: string | null
          suffix: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          works_in_lucena: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "citizens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_department: {
        Args: {
          p_code: string
          p_is_active: boolean
          p_label: string
          p_sort_order: number
        }
        Returns: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "departments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_event: {
        Args: {
          p_category_code: string
          p_description: string
          p_end_at: string
          p_id: string
          p_image_path: string
          p_is_published: boolean
          p_location_text: string
          p_start_at: string
          p_title: string
        }
        Returns: {
          category_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          image_path: string | null
          is_published: boolean
          location_text: string
          start_at: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_city_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_holiday: {
        Args: {
          p_id: string
          p_is_active: boolean
          p_kind: Database["public"]["Enums"]["holiday_kind"]
          p_name: string
          p_source: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["holiday_kind"]
          name: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "holidays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_incident_type: {
        Args: {
          p_code: string
          p_default_department_code: string
          p_is_active: boolean
          p_label: string
          p_sort_order: number
        }
        Returns: {
          base_level: Database["public"]["Enums"]["incident_level"]
          category_code: string
          code: string
          default_department_code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "incident_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_officer_of_record: {
        Args: {
          p_designation: string
          p_full_name: string
          p_service: Database["public"]["Enums"]["module_code"]
          p_unit: string
        }
        Returns: {
          designation: string
          full_name: string
          is_placeholder: boolean
          service: Database["public"]["Enums"]["module_code"]
          unit: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "officers_of_record"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_place: {
        Args: {
          p_address: string
          p_badge: string
          p_description: string
          p_id: string
          p_image_path: string
          p_is_published: boolean
          p_maps_query: string
          p_name: string
          p_section: Database["public"]["Enums"]["poi_section"]
        }
        Returns: {
          address: string | null
          badge: string | null
          created_at: string
          description: string
          id: string
          image_path: string | null
          is_published: boolean
          maps_query: string | null
          name: string
          section: Database["public"]["Enums"]["poi_section"]
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_points_of_interest"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_post: {
        Args: {
          p_body: string
          p_category_code: string
          p_end_at: string
          p_id: string
          p_image_path: string
          p_start_at: string
          p_title: string
        }
        Returns: {
          body: string
          category_code: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          created_by: string | null
          end_at: string | null
          id: string
          image_path: string | null
          is_published: boolean
          start_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_post_category: {
        Args: {
          p_code: string
          p_color_hex: string
          p_is_active: boolean
          p_label: string
          p_sort_order: number
        }
        Returns: {
          code: string
          color_hex: string
          is_active: boolean
          label: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "platform_post_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_site_info_entry: {
        Args: {
          p_id: string
          p_is_active: boolean
          p_label: string
          p_sort_order: number
          p_value: string
        }
        Returns: {
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["site_info_kind"]
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          value: string
        }
        SetofOptions: {
          from: "*"
          to: "site_info_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_staff_account: {
        Args: {
          p_department_code?: string
          p_employee_id?: string
          p_full_name: string
          p_id: string
          p_is_supervisor?: boolean
          p_modules: Database["public"]["Enums"]["module_code"][]
          p_phone?: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: {
          created_at: string
          department_code: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_supervisor: boolean
          last_change_at: string
          modules: Database["public"]["Enums"]["module_code"][]
          on_duty: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_yellow_card_application: {
        Args: {
          p_application_id: string
          p_barangay_code: string
          p_civil_status_code: string
          p_complete_address: string
          p_contact_number: string
          p_date_of_birth: string
          p_email_address: string
          p_first_name: string
          p_gender_code: string
          p_last_name: string
          p_middle_name?: string
          p_suffix?: string
          p_voter_id_number: string
          p_years_of_residency: number
        }
        Returns: {
          barangay_code: string
          citizen_id: string
          civil_status_code: string
          complete_address: string
          contact_number: string
          created_at: string
          current_review_id: string | null
          date_of_birth: string
          decided_at: string | null
          due_at: string | null
          email_address: string
          first_name: string
          gender_code: string
          id: string
          last_name: string
          middle_name: string | null
          needs_dedup_review: boolean
          privacy_consent: boolean
          reference_number: string
          sla_clock_started_at: string | null
          sla_elapsed_seconds: number
          sla_target_hours: number
          status: Database["public"]["Enums"]["yellow_card_application_status"]
          submitted_at: string
          suffix: string | null
          updated_at: string
          voter_id_number: string
          voter_id_number_normalized: string | null
          years_of_residency: number
        }
        SetofOptions: {
          from: "*"
          to: "yellow_card_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_yellow_card_document_type: {
        Args: {
          p_code: string
          p_is_active: boolean
          p_is_required: boolean
          p_label: string
          p_sort_order: number
        }
        Returns: {
          code: string
          is_active: boolean
          is_required: boolean
          label: string
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "yellow_card_document_types"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_payment: {
        Args: {
          p_decision: Database["public"]["Enums"]["staff_verification_decision"]
          p_official_receipt_no?: string
          p_payment_id: string
          p_reason?: string
        }
        Returns: {
          amount: number
          booking_id: string
          gcash_reference: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          official_receipt_no: string | null
          paid_at: string | null
          recorded_by: string | null
          rejected_reason: string | null
          submitted_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "booking_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_yellow_card: {
        Args: { p_token: string }
        Returns: {
          holder_name: string
          status: Database["public"]["Enums"]["yellow_card_status"]
        }[]
      }
      withdraw_yellow_card_application: {
        Args: { p_application_id: string }
        Returns: {
          barangay_code: string
          citizen_id: string
          civil_status_code: string
          complete_address: string
          contact_number: string
          created_at: string
          current_review_id: string | null
          date_of_birth: string
          decided_at: string | null
          due_at: string | null
          email_address: string
          first_name: string
          gender_code: string
          id: string
          last_name: string
          middle_name: string | null
          needs_dedup_review: boolean
          privacy_consent: boolean
          reference_number: string
          sla_clock_started_at: string | null
          sla_elapsed_seconds: number
          sla_target_hours: number
          status: Database["public"]["Enums"]["yellow_card_application_status"]
          submitted_at: string
          suffix: string | null
          updated_at: string
          voter_id_number: string
          voter_id_number_normalized: string | null
          years_of_residency: number
        }
        SetofOptions: {
          from: "*"
          to: "yellow_card_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      working_add: {
        Args: { p_from: string; p_seconds: number }
        Returns: string
      }
      working_seconds: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      write_audit: {
        Args: {
          p_area: Database["public"]["Enums"]["audit_area"]
          p_change: string
          p_changes?: Json
          p_detail?: string
          p_target_id: string
          p_target_kind: Database["public"]["Enums"]["audit_target_kind"]
          p_target_label: string
        }
        Returns: undefined
      }
      yc_deadline_state: {
        Args: {
          p_due_at: string
          p_sla_clock_started_at: string
          p_sla_elapsed_seconds: number
          p_sla_target_hours: number
          p_status: Database["public"]["Enums"]["yellow_card_application_status"]
        }
        Returns: string
      }
      yc_deadline_state_at: {
        Args: {
          p_at: string
          p_due_at: string
          p_sla_clock_started_at: string
          p_sla_elapsed_seconds: number
          p_sla_target_hours: number
          p_status: Database["public"]["Enums"]["yellow_card_application_status"]
        }
        Returns: string
      }
      yc_deadline_state_of: {
        Args: {
          p_due_at: string
          p_sla_clock_started_at: string
          p_sla_elapsed_seconds: number
          p_sla_target_hours: number
          p_status: Database["public"]["Enums"]["yellow_card_application_status"]
        }
        Returns: string
      }
      yc_recomputed_due_at: {
        Args: {
          p_sla_clock_started_at: string
          p_sla_elapsed_seconds: number
          p_sla_target_hours: number
          p_status: Database["public"]["Enums"]["yellow_card_application_status"]
        }
        Returns: string
      }
    }
    Enums: {
      actor_role: "system" | "citizen" | "staff" | "supervisor" | "responder"
      audit_area:
        | "accounts"
        | "configuration"
        | "catalogs"
        | "content"
        | "pii_access"
        | "calendar"
        | "auth"
      audit_target_kind:
        | "staff_account"
        | "citizen"
        | "config"
        | "catalog_entry"
        | "post"
        | "city_event"
        | "point_of_interest"
        | "yellow_card_application"
        | "yellow_card_export"
        | "incident"
        | "booking"
        | "calendar_entry"
      booking_cancellation_reason:
        | "rejected_by_staff"
        | "cancelled_by_citizen"
        | "expired_unpaid"
        | "expired_unrevised"
        | "no_show"
      booking_doc_kind: "org_document" | "gcash_receipt"
      booking_status:
        | "pending"
        | "awaiting_tier_review"
        | "awaiting_resubmission"
        | "awaiting_quote"
        | "awaiting_payment"
        | "payment_verification"
        | "confirmed"
        | "fully_paid"
        | "completed"
        | "cancelled"
      closure_reason:
        | "citizen_confirmed"
        | "auto_confirmed"
        | "invalid"
        | "duplicate"
        | "expired_unverified"
      content_type: "announcement" | "news"
      holiday_kind: "regular" | "special_non_working" | "local" | "suspension"
      incident_event_type:
        | "submitted"
        | "verified"
        | "routed"
        | "rerouted"
        | "claimed"
        | "stage_en_route"
        | "stage_on_site"
        | "stage_working"
        | "note"
        | "photo_added"
        | "released"
        | "force_released"
        | "rejected"
        | "resolved"
        | "confirmed"
        | "reopened"
        | "closed"
        | "expired"
        | "nudged"
      incident_level: "critical" | "high" | "medium" | "low"
      incident_status:
        | "open"
        | "in_pool"
        | "in_progress"
        | "resolved"
        | "closed"
      module_code: "yellow_card" | "incidents" | "booking" | "platform"
      notify_channel: "in_app" | "email" | "sms" | "push"
      notify_status: "queued" | "sent" | "failed" | "skipped" | "bounced"
      payment_kind: "downpayment" | "balance" | "refund"
      payment_method: "gcash" | "cash" | "bank_transfer" | "check"
      photo_kind: "before" | "after"
      poi_section: "go" | "eat" | "study" | "infrastructure"
      rate_tier: "commercial" | "discounted"
      site_info_kind: "emergency_hotline" | "office_contact" | "floor_directory"
      staff_role: "staff" | "responder" | "admin" | "super_staff"
      staff_verification_decision: "accept" | "reject"
      system_health_status: "ok" | "warning" | "critical"
      tier_review_decision: "accept" | "revise" | "reject"
      upload_kind:
        | "yellow_card_document"
        | "incident_photo"
        | "booking_document"
      yellow_card_application_status:
        | "pending"
        | "resubmitted"
        | "revision_requested"
        | "approved"
        | "rejected"
        | "withdrawn"
      yellow_card_decision: "approve" | "revise" | "reject"
      yellow_card_status: "active" | "revoked" | "superseded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actor_role: ["system", "citizen", "staff", "supervisor", "responder"],
      audit_area: [
        "accounts",
        "configuration",
        "catalogs",
        "content",
        "pii_access",
        "calendar",
        "auth",
      ],
      audit_target_kind: [
        "staff_account",
        "citizen",
        "config",
        "catalog_entry",
        "post",
        "city_event",
        "point_of_interest",
        "yellow_card_application",
        "yellow_card_export",
        "incident",
        "booking",
        "calendar_entry",
      ],
      booking_cancellation_reason: [
        "rejected_by_staff",
        "cancelled_by_citizen",
        "expired_unpaid",
        "expired_unrevised",
        "no_show",
      ],
      booking_doc_kind: ["org_document", "gcash_receipt"],
      booking_status: [
        "pending",
        "awaiting_tier_review",
        "awaiting_resubmission",
        "awaiting_quote",
        "awaiting_payment",
        "payment_verification",
        "confirmed",
        "fully_paid",
        "completed",
        "cancelled",
      ],
      closure_reason: [
        "citizen_confirmed",
        "auto_confirmed",
        "invalid",
        "duplicate",
        "expired_unverified",
      ],
      content_type: ["announcement", "news"],
      holiday_kind: ["regular", "special_non_working", "local", "suspension"],
      incident_event_type: [
        "submitted",
        "verified",
        "routed",
        "rerouted",
        "claimed",
        "stage_en_route",
        "stage_on_site",
        "stage_working",
        "note",
        "photo_added",
        "released",
        "force_released",
        "rejected",
        "resolved",
        "confirmed",
        "reopened",
        "closed",
        "expired",
        "nudged",
      ],
      incident_level: ["critical", "high", "medium", "low"],
      incident_status: ["open", "in_pool", "in_progress", "resolved", "closed"],
      module_code: ["yellow_card", "incidents", "booking", "platform"],
      notify_channel: ["in_app", "email", "sms", "push"],
      notify_status: ["queued", "sent", "failed", "skipped", "bounced"],
      payment_kind: ["downpayment", "balance", "refund"],
      payment_method: ["gcash", "cash", "bank_transfer", "check"],
      photo_kind: ["before", "after"],
      poi_section: ["go", "eat", "study", "infrastructure"],
      rate_tier: ["commercial", "discounted"],
      site_info_kind: [
        "emergency_hotline",
        "office_contact",
        "floor_directory",
      ],
      staff_role: ["staff", "responder", "admin", "super_staff"],
      staff_verification_decision: ["accept", "reject"],
      system_health_status: ["ok", "warning", "critical"],
      tier_review_decision: ["accept", "revise", "reject"],
      upload_kind: [
        "yellow_card_document",
        "incident_photo",
        "booking_document",
      ],
      yellow_card_application_status: [
        "pending",
        "resubmitted",
        "revision_requested",
        "approved",
        "rejected",
        "withdrawn",
      ],
      yellow_card_decision: ["approve", "revise", "reject"],
      yellow_card_status: ["active", "revoked", "superseded"],
    },
  },
} as const
