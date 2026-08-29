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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_profile_id: string
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
        }
        Insert: {
          action: string
          admin_profile_id: string
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
        }
        Update: {
          action?: string
          admin_profile_id?: string
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_ref: string
          created_at: string
          deleted_at: string | null
          id: string
          paymongo_session_id: string | null
          seats: number
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_schedule_id: string
          traveler_id: string
          updated_at: string
        }
        Insert: {
          booking_ref: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          paymongo_session_id?: string | null
          seats: number
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_schedule_id: string
          traveler_id: string
          updated_at?: string
        }
        Update: {
          booking_ref?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          paymongo_session_id?: string | null
          seats?: number
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          tour_schedule_id?: string
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_tour_schedule_id_fkey"
            columns: ["tour_schedule_id"]
            isOneToOne: false
            referencedRelation: "tour_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizer_favorite_vehicles: {
        Row: {
          created_at: string
          id: string
          organizer_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizer_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organizer_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_favorite_vehicles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_favorite_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_profiles: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          display_name: string
          id: string
          organizer_type: string
          phone: string
          provides_transport: boolean
          status: string
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          organizer_type: string
          phone: string
          provides_transport?: boolean
          status?: string
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          organizer_type?: string
          phone?: string
          provides_transport?: boolean
          status?: string
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_profiles_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_versions: {
        Row: {
          created_at: string | null
          id: string
          page_id: string
          sections: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_id: string
          sections: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          page_id?: string
          sections?: Json
        }
        Relationships: [
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          id: string
          path: string
          sections: Json
          title: string
          updated_at: string | null
          website_id: string
        }
        Insert: {
          id?: string
          path?: string
          sections?: Json
          title?: string
          updated_at?: string | null
          website_id: string
        }
        Update: {
          id?: string
          path?: string
          sections?: Json
          title?: string
          updated_at?: string | null
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          provider: string
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          provider: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          provider?: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          payout_method: Json
          status: Database["public"]["Enums"]["payout_status_enum"]
          updated_at: string
          wallet_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          payout_method: Json
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
          wallet_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          payout_method?: Json
          status?: Database["public"]["Enums"]["payout_status_enum"]
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          platform_fee_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          platform_fee_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          platform_fee_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          deleted_at: string | null
          id: string
          rating: number
          reviewer_profile_id: string
          status: Database["public"]["Enums"]["review_status"]
          tour_id: string | null
          transporter_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          rating: number
          reviewer_profile_id: string
          status?: Database["public"]["Enums"]["review_status"]
          tour_id?: string | null
          transporter_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          rating?: number
          reviewer_profile_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          tour_id?: string | null
          transporter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewer_profile_id_fkey"
            columns: ["reviewer_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporter_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sections: {
        Row: {
          category: string
          created_at: string | null
          default_props: Json
          id: string
          label: string
          registry_key: string
          section_key: string
          template_id: string | null
          thumbnail_url: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          default_props?: Json
          id?: string
          label: string
          registry_key: string
          section_key: string
          template_id?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          default_props?: Json
          id?: string
          label?: string
          registry_key?: string
          section_key?: string
          template_id?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_published: boolean | null
          name: string
          slug: string
          thumbnail_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          name: string
          slug: string
          thumbnail_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          name?: string
          slug?: string
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      tour_itineraries: {
        Row: {
          created_at: string
          day_number: number
          deleted_at: string | null
          description: string
          id: string
          title: string
          tour_id: string
        }
        Insert: {
          created_at?: string
          day_number: number
          deleted_at?: string | null
          description: string
          id?: string
          title: string
          tour_id: string
        }
        Update: {
          created_at?: string
          day_number?: number
          deleted_at?: string | null
          description?: string
          id?: string
          title?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_itineraries_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_schedules: {
        Row: {
          booked_count: number
          capacity: number
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          original_price: number | null
          price_per_person: number | null
          start_date: string
          status: Database["public"]["Enums"]["tour_schedule_status"]
          tour_id: string
          transport_status: string
          transport_type: string
          updated_at: string
        }
        Insert: {
          booked_count?: number
          capacity: number
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          original_price?: number | null
          price_per_person?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["tour_schedule_status"]
          tour_id: string
          transport_status?: string
          transport_type?: string
          updated_at?: string
        }
        Update: {
          booked_count?: number
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          original_price?: number | null
          price_per_person?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["tour_schedule_status"]
          tour_id?: string
          transport_status?: string
          transport_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_schedules_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          accommodation_details: string | null
          city: string | null
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          description: string
          duration_days: number
          format: Database["public"]["Enums"]["tour_format_enum"]
          id: string
          image_urls: string[] | null
          latitude: number | null
          location: string
          longitude: number | null
          organizer_id: string
          price_per_person: number
          province: string | null
          slug: string
          status: string
          themes: string[]
          title: string
          travel_time_info: string | null
          updated_at: string
        }
        Insert: {
          accommodation_details?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description: string
          duration_days: number
          format?: Database["public"]["Enums"]["tour_format_enum"]
          id?: string
          image_urls?: string[] | null
          latitude?: number | null
          location: string
          longitude?: number | null
          organizer_id: string
          price_per_person: number
          province?: string | null
          slug: string
          status?: string
          themes?: string[]
          title: string
          travel_time_info?: string | null
          updated_at?: string
        }
        Update: {
          accommodation_details?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          duration_days?: number
          format?: Database["public"]["Enums"]["tour_format_enum"]
          id?: string
          image_urls?: string[] | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          organizer_id?: string
          price_per_person?: number
          province?: string | null
          slug?: string
          status?: string
          themes?: string[]
          title?: string
          travel_time_info?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tours_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_bookings: {
        Row: {
          created_at: string
          deleted_at: string | null
          dropoff_location: string
          estimated_price: number | null
          id: string
          organizer_id: string | null
          pickup_datetime: string
          pickup_location: string
          return_datetime: string | null
          seats_required: number
          status: string
          tour_schedule_id: string | null
          transporter_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dropoff_location: string
          estimated_price?: number | null
          id?: string
          organizer_id?: string | null
          pickup_datetime: string
          pickup_location: string
          return_datetime?: string | null
          seats_required: number
          status?: string
          tour_schedule_id?: string | null
          transporter_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dropoff_location?: string
          estimated_price?: number | null
          id?: string
          organizer_id?: string | null
          pickup_datetime?: string
          pickup_location?: string
          return_datetime?: string | null
          seats_required?: number
          status?: string
          tour_schedule_id?: string | null
          transporter_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_bookings_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_bookings_tour_schedule_id_fkey"
            columns: ["tour_schedule_id"]
            isOneToOne: false
            referencedRelation: "tour_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_bookings_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporter_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transporter_profiles: {
        Row: {
          average_rating: number
          company_name: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          display_name: string
          id: string
          phone: string
          review_count: number
          service_areas: string[] | null
          status: string
          transporter_type: string
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          average_rating?: number
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          phone: string
          review_count?: number
          service_areas?: string[] | null
          status?: string
          transporter_type: string
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          average_rating?: number
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          phone?: string
          review_count?: number
          service_areas?: string[] | null
          status?: string
          transporter_type?: string
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transporter_profiles_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          user_profile_id: string
          website_role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_profile_id: string
          website_role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_profile_id?: string
          website_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_website_role_id_fkey"
            columns: ["website_role_id"]
            isOneToOne: false
            referencedRelation: "website_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          escrow_balance: number
          id: string
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_availability: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          transport_booking_id: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          transport_booking_id?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          transport_booking_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_availability_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          photos: string[] | null
          plate_number: string | null
          rate_per_day: number | null
          seat_capacity: number
          status: string
          transporter_id: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          photos?: string[] | null
          plate_number?: string | null
          rate_per_day?: number | null
          seat_capacity: number
          status?: string
          transporter_id: string
          updated_at?: string
          vehicle_type: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          photos?: string[] | null
          plate_number?: string | null
          rate_per_day?: number | null
          seat_capacity?: number
          status?: string
          transporter_id?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporter_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_affected: string
          created_at: string
          description: string | null
          id: string
          reference_id: string
          reference_type: string
          type: Database["public"]["Enums"]["transaction_type_enum"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_affected: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id: string
          reference_type: string
          type: Database["public"]["Enums"]["transaction_type_enum"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_affected?: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string
          reference_type?: string
          type?: Database["public"]["Enums"]["transaction_type_enum"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      website_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          website_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          website_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_roles_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          created_at: string | null
          id: string
          name: string
          status: string | null
          subdomain: string | null
          template_id: string | null
          theme: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          subdomain?: string | null
          template_id?: string | null
          theme?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          subdomain?: string | null
          template_id?: string | null
          theme?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "websites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_user_wallet: { Args: { profile_id: string }; Returns: string }
      expire_pending_bookings: { Args: never; Returns: undefined }
      increment_escrow_balance: {
        Args: { amt: number; w_id: string }
        Returns: undefined
      }
      is_organizer_for_traveler: {
        Args: { traveler_profile_id: string }
        Returns: boolean
      }
      release_tour_escrow: {
        Args: { p_schedule_id: string }
        Returns: undefined
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "confirmed"
        | "canceled"
        | "refunded"
        | "completed"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      payout_status_enum: "pending" | "processing" | "paid" | "rejected"
      review_status: "pending" | "published" | "hidden"
      tour_format_enum: "joiner" | "private" | "solo"
      tour_schedule_status: "open" | "full" | "cancelled"
      transaction_type_enum:
        | "payment_hold"
        | "escrow_release"
        | "withdrawal_pending"
        | "withdrawal_completed"
        | "withdrawal_rejected"
        | "refund"
        | "platform_fee"
        | "manual_adjustment"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      booking_status: [
        "pending",
        "confirmed",
        "canceled",
        "refunded",
        "completed",
      ],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      payout_status_enum: ["pending", "processing", "paid", "rejected"],
      review_status: ["pending", "published", "hidden"],
      tour_format_enum: ["joiner", "private", "solo"],
      tour_schedule_status: ["open", "full", "cancelled"],
      transaction_type_enum: [
        "payment_hold",
        "escrow_release",
        "withdrawal_pending",
        "withdrawal_completed",
        "withdrawal_rejected",
        "refund",
        "platform_fee",
        "manual_adjustment",
      ],
    },
  },
} as const
