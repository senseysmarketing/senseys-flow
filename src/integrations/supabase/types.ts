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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_meta_config: {
        Row: {
          account_id: string
          ad_account_id: string
          ad_account_name: string | null
          created_at: string | null
          form_id: string | null
          form_name: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          page_id: string | null
          page_name: string | null
          pixel_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          ad_account_id: string
          ad_account_name?: string | null
          created_at?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          page_id?: string | null
          page_name?: string | null
          pixel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          ad_account_id?: string
          ad_account_name?: string | null
          created_at?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          page_id?: string | null
          page_name?: string | null
          pixel_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_meta_config_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          company_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      broker_round_robin: {
        Row: {
          account_id: string
          broker_order: Json | null
          id: string
          last_broker_index: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          broker_order?: Json | null
          id?: string
          last_broker_index?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          broker_order?: Json | null
          id?: string
          last_broker_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_round_robin_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          account_id: string
          created_at: string
          field_key: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          name: string
          options: Json | null
          placeholder: string | null
          position: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          name: string
          options?: Json | null
          placeholder?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          name?: string
          options?: Json | null
          placeholder?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_rules: {
        Row: {
          account_id: string
          conditions: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          rule_type: string
          target_broker_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          rule_type: string
          target_broker_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          rule_type?: string
          target_broker_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_rules_target_broker_id_fkey"
            columns: ["target_broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      events: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          lead_id: string | null
          location: string | null
          property_id: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          lead_id?: string | null
          location?: string | null
          property_id?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          lead_id?: string | null
          location?: string | null
          property_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          account_id: string
          activity_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          account_id: string
          activity_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          account_id?: string
          activity_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_custom_field_values: {
        Row: {
          created_at: string
          custom_field_id: string
          id: string
          lead_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          custom_field_id: string
          id?: string
          lead_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          custom_field_id?: string
          id?: string
          lead_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status: {
        Row: {
          account_id: string
          color: string
          created_at: string
          id: string
          is_default: boolean | null
          is_system: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          is_system?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          is_system?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          account_id: string
          anuncio: string | null
          assigned_broker_id: string | null
          campanha: string | null
          conjunto: string | null
          created_at: string
          email: string | null
          id: string
          interesse: string | null
          meta_ad_id: string | null
          meta_ad_name: string | null
          meta_campaign_id: string | null
          meta_campaign_name: string | null
          meta_form_id: string | null
          meta_lead_id: string | null
          name: string
          observacoes: string | null
          origem: string | null
          phone: string
          property_id: string | null
          status_id: string | null
          temperature: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          anuncio?: string | null
          assigned_broker_id?: string | null
          campanha?: string | null
          conjunto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interesse?: string | null
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          meta_form_id?: string | null
          meta_lead_id?: string | null
          name: string
          observacoes?: string | null
          origem?: string | null
          phone: string
          property_id?: string | null
          status_id?: string | null
          temperature?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          anuncio?: string | null
          assigned_broker_id?: string | null
          campanha?: string | null
          conjunto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interesse?: string | null
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          meta_form_id?: string | null
          meta_lead_id?: string | null
          name?: string
          observacoes?: string | null
          origem?: string | null
          phone?: string
          property_id?: string | null
          status_id?: string | null
          temperature?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_status"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_insights: {
        Row: {
          account_id: string
          campaign_data: Json | null
          clicks: number | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string | null
          date: string
          id: string
          impressions: number | null
          leads_count: number | null
          reach: number | null
          spend: number | null
        }
        Insert: {
          account_id: string
          campaign_data?: Json | null
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string | null
          date: string
          id?: string
          impressions?: number | null
          leads_count?: number | null
          reach?: number | null
          spend?: number | null
        }
        Update: {
          account_id?: string
          campaign_data?: Json | null
          clicks?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number | null
          leads_count?: number | null
          reach?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_agency_token: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      meta_capi_events_log: {
        Row: {
          account_id: string
          error_message: string | null
          event_id: string
          event_name: string
          id: string
          lead_id: string | null
          pixel_id: string | null
          response_body: Json | null
          sent_at: string | null
          status_code: number | null
        }
        Insert: {
          account_id: string
          error_message?: string | null
          event_id: string
          event_name: string
          id?: string
          lead_id?: string | null
          pixel_id?: string | null
          response_body?: Json | null
          sent_at?: string | null
          status_code?: number | null
        }
        Update: {
          account_id?: string
          error_message?: string | null
          event_id?: string
          event_name?: string
          id?: string
          lead_id?: string | null
          pixel_id?: string | null
          response_body?: Json | null
          sent_at?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_events_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_event_mappings: {
        Row: {
          account_id: string
          created_at: string | null
          event_name: string
          id: string
          is_active: boolean | null
          lead_type: string | null
          status_id: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          event_name: string
          id?: string
          is_active?: boolean | null
          lead_type?: string | null
          status_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          event_name?: string
          id?: string
          is_active?: boolean | null
          lead_type?: string | null
          status_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_event_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_event_mappings_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_status"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_form_configs: {
        Row: {
          account_id: string
          created_at: string
          form_id: string
          form_name: string | null
          hot_threshold: number
          id: string
          is_configured: boolean
          reference_field_name: string | null
          updated_at: string
          warm_threshold: number
        }
        Insert: {
          account_id: string
          created_at?: string
          form_id: string
          form_name?: string | null
          hot_threshold?: number
          id?: string
          is_configured?: boolean
          reference_field_name?: string | null
          updated_at?: string
          warm_threshold?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          form_id?: string
          form_name?: string | null
          hot_threshold?: number
          id?: string
          is_configured?: boolean
          reference_field_name?: string | null
          updated_at?: string
          warm_threshold?: number
        }
        Relationships: []
      }
      meta_form_scoring_rules: {
        Row: {
          answer_value: string
          created_at: string
          form_config_id: string
          id: string
          question_label: string | null
          question_name: string
          score: number
          updated_at: string
        }
        Insert: {
          answer_value: string
          created_at?: string
          form_config_id: string
          id?: string
          question_label?: string | null
          question_name: string
          score?: number
          updated_at?: string
        }
        Update: {
          answer_value?: string
          created_at?: string
          form_config_id?: string
          id?: string
          question_label?: string | null
          question_name?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_form_scoring_rules_form_config_id_fkey"
            columns: ["form_config_id"]
            isOneToOne: false
            referencedRelation: "meta_form_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: Database["public"]["Enums"]["permission_category"]
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["permission_category"]
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["permission_category"]
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_id: string
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          account_id: string
          address: string | null
          amenities: Json | null
          area_m2: number | null
          assigned_broker_id: string | null
          bathrooms: number | null
          bedrooms: number | null
          campaign_cost: number | null
          campaign_name: string | null
          city: string | null
          condo_fee: number | null
          created_at: string | null
          description: string | null
          id: string
          image_urls: Json | null
          iptu: number | null
          neighborhood: string | null
          parking_spots: number | null
          reference_code: string | null
          rent_price: number | null
          sale_price: number | null
          state: string | null
          status: string | null
          title: string
          transaction_type: string
          type: string
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          amenities?: Json | null
          area_m2?: number | null
          assigned_broker_id?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          campaign_cost?: number | null
          campaign_name?: string | null
          city?: string | null
          condo_fee?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: Json | null
          iptu?: number | null
          neighborhood?: string | null
          parking_spots?: number | null
          reference_code?: string | null
          rent_price?: number | null
          sale_price?: number | null
          state?: string | null
          status?: string | null
          title: string
          transaction_type: string
          type: string
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          amenities?: Json | null
          area_m2?: number | null
          assigned_broker_id?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          campaign_cost?: number | null
          campaign_name?: string | null
          city?: string | null
          condo_fee?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: Json | null
          iptu?: number | null
          neighborhood?: string | null
          parking_spots?: number | null
          reference_code?: string | null
          rent_price?: number | null
          sale_price?: number | null
          state?: string | null
          status?: string | null
          title?: string
          transaction_type?: string
          type?: string
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id: string
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          account_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          used: boolean
        }
        Insert: {
          account_id: string
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by: string
          used?: boolean
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          used?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          template: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          template: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: { Args: { p_invite_id: string }; Returns: Json }
      create_default_roles: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      get_user_account_id: { Args: never; Returns: string }
      get_user_role_id: { Args: { _user_id?: string }; Returns: string }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      invite_user_to_account: {
        Args: {
          p_email: string
          p_full_name: string
          p_password: string
          p_target_account_id: string
        }
        Returns: Json
      }
      is_account_owner: { Args: { _user_id?: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
    }
    Enums: {
      permission_category:
        | "leads"
        | "reports"
        | "team"
        | "settings"
        | "calendar"
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
      permission_category: ["leads", "reports", "team", "settings", "calendar"],
    },
  },
} as const
