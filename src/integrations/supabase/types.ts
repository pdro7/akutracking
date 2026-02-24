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
      course_enrollments: {
        Row: {
          created_at: string
          enrollment_date: string
          group_id: string
          id: string
          installment_1_amount: number | null
          installment_1_paid_at: string | null
          installment_2_amount: number | null
          installment_2_due_date: string | null
          installment_2_paid_at: string | null
          notes: string | null
          payment_plan: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrollment_date?: string
          group_id: string
          id?: string
          installment_1_amount?: number | null
          installment_1_paid_at?: string | null
          installment_2_amount?: number | null
          installment_2_due_date?: string | null
          installment_2_paid_at?: string | null
          notes?: string | null
          payment_plan?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrollment_date?: string
          group_id?: string
          id?: string
          installment_1_amount?: number | null
          installment_1_paid_at?: string | null
          installment_2_amount?: number | null
          installment_2_due_date?: string | null
          installment_2_paid_at?: string | null
          notes?: string | null
          payment_plan?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      course_groups: {
        Row: {
          code: string
          created_at: string
          end_date: string | null
          id: string
          min_students: number
          notes: string | null
          start_date: string
          status: string
          updated_at: string
          virtual_course_id: string
        }
        Insert: {
          code: string
          created_at?: string
          end_date?: string | null
          id?: string
          min_students?: number
          notes?: string | null
          start_date: string
          status?: string
          updated_at?: string
          virtual_course_id: string
        }
        Update: {
          code?: string
          created_at?: string
          end_date?: string | null
          id?: string
          min_students?: number
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          virtual_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_groups_virtual_course_id_fkey"
            columns: ["virtual_course_id"]
            isOneToOne: false
            referencedRelation: "virtual_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          created_at: string
          group_id: string
          id: string
          notes: string | null
          scheduled_date: string
          session_number: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          notes?: string | null
          scheduled_date: string
          session_number: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          notes?: string | null
          scheduled_date?: string
          session_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_courses: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          next_course_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          next_course_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          next_course_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_courses_next_course_id_fkey"
            columns: ["next_course_id"]
            isOneToOne: false
            referencedRelation: "virtual_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          area: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          attended: boolean
          course_session_id: string | null
          created_at: string
          date: string
          id: string
          is_makeup: boolean
          makeup_reason: string | null
          marked_by: string
          student_id: string
        }
        Insert: {
          attended: boolean
          course_session_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_makeup?: boolean
          makeup_reason?: string | null
          marked_by: string
          student_id: string
        }
        Update: {
          attended?: boolean
          course_session_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_makeup?: boolean
          makeup_reason?: string | null
          marked_by?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_logs: {
        Row: {
          activity_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          module_id: string | null
          progress_level: number | null
          project_name: string | null
          student_id: string
          updated_at: string
          where_left_off: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          module_id?: string | null
          progress_level?: number | null
          project_name?: string | null
          student_id: string
          updated_at?: string
          where_left_off?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          module_id?: string | null
          progress_level?: number | null
          project_name?: string | null
          student_id?: string
          updated_at?: string
          where_left_off?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_logs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          class_day: string
          created_at: string
          default_pack_size: number
          id: string
          payment_methods: string[] | null
          updated_at: string
        }
        Insert: {
          class_day?: string
          created_at?: string
          default_pack_size?: number
          id?: string
          payment_methods?: string[] | null
          updated_at?: string
        }
        Update: {
          class_day?: string
          created_at?: string
          default_pack_size?: number
          id?: string
          payment_methods?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          archived: boolean
          classes_attended: number
          classes_remaining: number
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrollment_date: string
          father_name: string | null
          grade_level: string | null
          id: string
          is_active: boolean
          last_payment_date: string | null
          medical_conditions: string | null
          modality: string
          mother_name: string | null
          name: string
          notes: string | null
          pack_size: number
          parent_name: string
          phone: string
          school_name: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived?: boolean
          classes_attended?: number
          classes_remaining?: number
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string
          father_name?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean
          last_payment_date?: string | null
          medical_conditions?: string | null
          modality?: string
          mother_name?: string | null
          name: string
          notes?: string | null
          pack_size?: number
          parent_name: string
          phone: string
          school_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived?: boolean
          classes_attended?: number
          classes_remaining?: number
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string
          father_name?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean
          last_payment_date?: string | null
          medical_conditions?: string | null
          modality?: string
          mother_name?: string | null
          name?: string
          notes?: string | null
          pack_size?: number
          parent_name?: string
          phone?: string
          school_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trial_leads: {
        Row: {
          child_name: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          id: string
          notes: string | null
          parent_email: string | null
          parent_name: string
          parent_phone: string
          status: Database["public"]["Enums"]["trial_lead_status"]
          trial_class_date: string
          updated_at: string
        }
        Insert: {
          child_name: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          id?: string
          notes?: string | null
          parent_email?: string | null
          parent_name: string
          parent_phone: string
          status?: Database["public"]["Enums"]["trial_lead_status"]
          trial_class_date: string
          updated_at?: string
        }
        Update: {
          child_name?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          id?: string
          notes?: string | null
          parent_email?: string | null
          parent_name?: string
          parent_phone?: string
          status?: Database["public"]["Enums"]["trial_lead_status"]
          trial_class_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "staff" | "admin"
      trial_lead_status:
        | "scheduled"
        | "attended"
        | "converted"
        | "cancelled"
        | "no_show"
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
      app_role: ["staff", "admin"],
      trial_lead_status: [
        "scheduled",
        "attended",
        "converted",
        "cancelled",
        "no_show",
      ],
    },
  },
} as const
