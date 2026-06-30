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
      adhkar_items: {
        Row: {
          arabic: string
          created_at: string
          habit_id: string
          id: string
          repeat_count: number
          sort_order: number
          source: string | null
          translation: string | null
          transliteration: string | null
          user_id: string
        }
        Insert: {
          arabic: string
          created_at?: string
          habit_id: string
          id?: string
          repeat_count?: number
          sort_order?: number
          source?: string | null
          translation?: string | null
          transliteration?: string | null
          user_id: string
        }
        Update: {
          arabic?: string
          created_at?: string
          habit_id?: string
          id?: string
          repeat_count?: number
          sort_order?: number
          source?: string | null
          translation?: string | null
          transliteration?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adhkar_items_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_checklist_items: {
        Row: {
          habit_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          habit_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          habit_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "habit_checklist_items_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          completed_bool: boolean
          completed_items: Json
          habit_id: string
          id: string
          log_date: string
          updated_at: string
          user_id: string
          value_num: number
        }
        Insert: {
          completed_bool?: boolean
          completed_items?: Json
          habit_id: string
          id?: string
          log_date: string
          updated_at?: string
          user_id: string
          value_num?: number
        }
        Update: {
          completed_bool?: boolean
          completed_items?: Json
          habit_id?: string
          id?: string
          log_date?: string
          updated_at?: string
          user_id?: string
          value_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_templates: {
        Row: {
          category: Database["public"]["Enums"]["habit_category"]
          checklist_labels: Json
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          key: string
          menstruation_behavior: Database["public"]["Enums"]["menstruation_behavior"]
          name: string
          name_ar: string | null
          recurrence_data: Json
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          sort_order: number
          source_url: string | null
          subcategory: Database["public"]["Enums"]["habit_subcategory"]
          target: number | null
          type: Database["public"]["Enums"]["habit_type"]
          unit: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["habit_category"]
          checklist_labels?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          key: string
          menstruation_behavior?: Database["public"]["Enums"]["menstruation_behavior"]
          name: string
          name_ar?: string | null
          recurrence_data?: Json
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          sort_order?: number
          source_url?: string | null
          subcategory: Database["public"]["Enums"]["habit_subcategory"]
          target?: number | null
          type: Database["public"]["Enums"]["habit_type"]
          unit?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["habit_category"]
          checklist_labels?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          key?: string
          menstruation_behavior?: Database["public"]["Enums"]["menstruation_behavior"]
          name?: string
          name_ar?: string | null
          recurrence_data?: Json
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          sort_order?: number
          source_url?: string | null
          subcategory?: Database["public"]["Enums"]["habit_subcategory"]
          target?: number | null
          type?: Database["public"]["Enums"]["habit_type"]
          unit?: string | null
        }
        Relationships: []
      }
      habits: {
        Row: {
          archived_at: string | null
          category: Database["public"]["Enums"]["habit_category"] | null
          created_at: string
          id: string
          menstruation_behavior:
            | Database["public"]["Enums"]["menstruation_behavior"]
            | null
          name: string
          name_ar: string | null
          quran_tracking_mode:
            | Database["public"]["Enums"]["quran_tracking_mode"]
            | null
          recurrence_data: Json
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          sort_order: number
          subcategory: Database["public"]["Enums"]["habit_subcategory"] | null
          target: number | null
          template_id: string | null
          type: Database["public"]["Enums"]["habit_type"]
          unit: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: Database["public"]["Enums"]["habit_category"] | null
          created_at?: string
          id?: string
          menstruation_behavior?:
            | Database["public"]["Enums"]["menstruation_behavior"]
            | null
          name: string
          name_ar?: string | null
          quran_tracking_mode?:
            | Database["public"]["Enums"]["quran_tracking_mode"]
            | null
          recurrence_data?: Json
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          sort_order?: number
          subcategory?: Database["public"]["Enums"]["habit_subcategory"] | null
          target?: number | null
          template_id?: string | null
          type?: Database["public"]["Enums"]["habit_type"]
          unit?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category?: Database["public"]["Enums"]["habit_category"] | null
          created_at?: string
          id?: string
          menstruation_behavior?:
            | Database["public"]["Enums"]["menstruation_behavior"]
            | null
          name?: string
          name_ar?: string | null
          quran_tracking_mode?:
            | Database["public"]["Enums"]["quran_tracking_mode"]
            | null
          recurrence_data?: Json
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          sort_order?: number
          subcategory?: Database["public"]["Enums"]["habit_subcategory"] | null
          target?: number | null
          template_id?: string | null
          type?: Database["public"]["Enums"]["habit_type"]
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "habit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      menstrual_cycle_logs: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_goal_pct: number
          display_name: string | null
          id: string
          madhab: string | null
          tracks_menstruation: boolean
        }
        Insert: {
          created_at?: string
          daily_goal_pct?: number
          display_name?: string | null
          id: string
          madhab?: string | null
          tracks_menstruation?: boolean
        }
        Update: {
          created_at?: string
          daily_goal_pct?: number
          display_name?: string | null
          id?: string
          madhab?: string | null
          tracks_menstruation?: boolean
        }
        Relationships: []
      }
      quran_reading_state: {
        Row: {
          ayah: number
          created_at: string
          habit_id: string
          id: string
          show_translation: boolean
          surah: number
          updated_at: string
          user_id: string
          view_mode: string
        }
        Insert: {
          ayah?: number
          created_at?: string
          habit_id: string
          id?: string
          show_translation?: boolean
          surah?: number
          updated_at?: string
          user_id: string
          view_mode?: string
        }
        Update: {
          ayah?: number
          created_at?: string
          habit_id?: string
          id?: string
          show_translation?: boolean
          surah?: number
          updated_at?: string
          user_id?: string
          view_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "quran_reading_state_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seed_evening_adhkar: {
        Args: { _habit_id: string; _user_id: string }
        Returns: undefined
      }
      seed_morning_adhkar: {
        Args: { _habit_id: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      habit_category: "fard" | "sunnah"
      habit_subcategory: "prayer" | "dhikr" | "quran" | "fasting" | "character"
      habit_type: "boolean" | "counter" | "checklist"
      menstruation_behavior:
        | "always_pause"
        | "never_pause"
        | "depends_on_madhab"
      quran_tracking_mode: "pages" | "verses" | "minutes"
      recurrence_type: "daily" | "weekly" | "hijri_monthly" | "hijri_annual"
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
      habit_category: ["fard", "sunnah"],
      habit_subcategory: ["prayer", "dhikr", "quran", "fasting", "character"],
      habit_type: ["boolean", "counter", "checklist"],
      menstruation_behavior: [
        "always_pause",
        "never_pause",
        "depends_on_madhab",
      ],
      quran_tracking_mode: ["pages", "verses", "minutes"],
      recurrence_type: ["daily", "weekly", "hijri_monthly", "hijri_annual"],
    },
  },
} as const
