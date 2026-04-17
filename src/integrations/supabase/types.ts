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
      aircraft_lookup_cache: {
        Row: {
          aircraft_type_code: string | null
          created_at: string
          expires_at: string
          icao24: string | null
          id: string
          lookup_source: string | null
          manufacturer: string | null
          model: string | null
          normalized_registration: string
          operator_name: string | null
          raw_response: Json | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aircraft_type_code?: string | null
          created_at?: string
          expires_at?: string
          icao24?: string | null
          id?: string
          lookup_source?: string | null
          manufacturer?: string | null
          model?: string | null
          normalized_registration: string
          operator_name?: string | null
          raw_response?: Json | null
          serial_number?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          aircraft_type_code?: string | null
          created_at?: string
          expires_at?: string
          icao24?: string | null
          id?: string
          lookup_source?: string | null
          manufacturer?: string | null
          model?: string | null
          normalized_registration?: string
          operator_name?: string | null
          raw_response?: Json | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      aircraft_profiles: {
        Row: {
          aircraft_type_code: string | null
          created_at: string
          icao24: string | null
          id: string
          is_manual_override: boolean
          lookup_source: string | null
          lookup_status: string | null
          lookup_timestamp: string | null
          manufacturer: string | null
          model: string | null
          normalized_registration: string
          operator_name: string | null
          registration: string
          remarks: string | null
          serial_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aircraft_type_code?: string | null
          created_at?: string
          icao24?: string | null
          id?: string
          is_manual_override?: boolean
          lookup_source?: string | null
          lookup_status?: string | null
          lookup_timestamp?: string | null
          manufacturer?: string | null
          model?: string | null
          normalized_registration: string
          operator_name?: string | null
          registration: string
          remarks?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aircraft_type_code?: string | null
          created_at?: string
          icao24?: string | null
          id?: string
          is_manual_override?: boolean
          lookup_source?: string | null
          lookup_status?: string | null
          lookup_timestamp?: string | null
          manufacturer?: string | null
          model?: string | null
          normalized_registration?: string
          operator_name?: string | null
          registration?: string
          remarks?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      licences: {
        Row: {
          authority: string | null
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          licence_number: string | null
          licence_type: string | null
          ratings: string | null
          remarks: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          authority?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          licence_number?: string | null
          licence_type?: string | null
          ratings?: string | null
          remarks?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          authority?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          licence_number?: string | null
          licence_type?: string | null
          ratings?: string | null
          remarks?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          action_taken: string | null
          aircraft_model: string | null
          aircraft_profile_id: string | null
          ata_chapter: string | null
          created_at: string
          fault_description: string
          id: string
          image_urls: string[]
          is_recurring: boolean
          manufacturer: string | null
          registration: string | null
          root_cause: string | null
          symptoms: string[]
          time_spent_hours: number
          tools_used: string | null
          updated_at: string
          user_id: string
          voice_note_url: string | null
        }
        Insert: {
          action_taken?: string | null
          aircraft_model?: string | null
          aircraft_profile_id?: string | null
          ata_chapter?: string | null
          created_at?: string
          fault_description: string
          id?: string
          image_urls?: string[]
          is_recurring?: boolean
          manufacturer?: string | null
          registration?: string | null
          root_cause?: string | null
          symptoms?: string[]
          time_spent_hours?: number
          tools_used?: string | null
          updated_at?: string
          user_id: string
          voice_note_url?: string | null
        }
        Update: {
          action_taken?: string | null
          aircraft_model?: string | null
          aircraft_profile_id?: string | null
          ata_chapter?: string | null
          created_at?: string
          fault_description?: string
          id?: string
          image_urls?: string[]
          is_recurring?: boolean
          manufacturer?: string | null
          registration?: string | null
          root_cause?: string | null
          symptoms?: string[]
          time_spent_hours?: number
          tools_used?: string | null
          updated_at?: string
          user_id?: string
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_aircraft_profile_id_fkey"
            columns: ["aircraft_profile_id"]
            isOneToOne: false
            referencedRelation: "aircraft_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          ame_licence_no: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          ame_licence_no?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          ame_licence_no?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      upsert_aircraft_lookup_cache: {
        Args: {
          p_icao24: string
          p_manufacturer: string
          p_model: string
          p_norm: string
          p_operator: string
          p_raw: Json
          p_serial: string
          p_source: string
          p_status: string
          p_type_code: string
        }
        Returns: {
          aircraft_type_code: string | null
          created_at: string
          expires_at: string
          icao24: string | null
          id: string
          lookup_source: string | null
          manufacturer: string | null
          model: string | null
          normalized_registration: string
          operator_name: string | null
          raw_response: Json | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "aircraft_lookup_cache"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
