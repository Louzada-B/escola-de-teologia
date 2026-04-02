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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          access_date: string
          accessed_at: string
          id: string
          user_id: string
        }
        Insert: {
          access_date?: string
          accessed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          access_date?: string
          accessed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          title: string
        }
        Insert: {
          content: string
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          title: string
        }
        Update: {
          content?: string
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          checked_in_at: string
          id: string
          latitude: number
          lesson_id: string
          longitude: number
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          latitude: number
          lesson_id: string
          longitude: number
          user_id: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          latitude?: number
          lesson_id?: string
          longitude?: number
          user_id?: string
        }
        Relationships: []
      }
      attendance_settings: {
        Row: {
          course_id: string | null
          id: string
          latitude: number
          longitude: number
          radius_meters: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          course_id?: string | null
          id?: string
          latitude: number
          longitude: number
          radius_meters?: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          course_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
          radius_meters?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      book_promotions: {
        Row: {
          author: string | null
          course_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          purchase_url: string | null
          title: string
        }
        Insert: {
          author?: string | null
          course_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          purchase_url?: string | null
          title: string
        }
        Update: {
          author?: string | null
          course_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          purchase_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_promotions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          lesson_id: string | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_type?: string
          id?: string
          lesson_id?: string | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          lesson_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          background_url: string | null
          body_text: string
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          background_url?: string | null
          body_text?: string
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          background_url?: string | null
          body_text?: string
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_students: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_students_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          course_id: string | null
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          semester: number
          start_date: string
          year: number
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          semester: number
          start_date: string
          year: number
        }
        Update: {
          course_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          semester?: number
          start_date?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_evaluations: {
        Row: {
          additional_comments: string | null
          cohort_id: string
          created_at: string
          id: string
          improvements: string
          liked_most: string
          overall_rating: number
          professors_rating: number
          user_id: string
          would_recommend: boolean
        }
        Insert: {
          additional_comments?: string | null
          cohort_id: string
          created_at?: string
          id?: string
          improvements: string
          liked_most: string
          overall_rating: number
          professors_rating: number
          user_id: string
          would_recommend: boolean
        }
        Update: {
          additional_comments?: string | null
          cohort_id?: string
          created_at?: string
          id?: string
          improvements?: string
          liked_most?: string
          overall_rating?: number
          professors_rating?: number
          user_id?: string
          would_recommend?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "course_evaluations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      course_professors: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_professors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      extra_materials: {
        Row: {
          category: string
          course_id: string | null
          created_at: string
          created_by: string
          description: string | null
          external_url: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          material_type: string
          title: string
        }
        Insert: {
          category?: string
          course_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          material_type?: string
          title: string
        }
        Update: {
          category?: string
          course_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          material_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      issued_certificates: {
        Row: {
          cohort_id: string
          id: string
          issued_at: string
          issued_by: string
          template_id: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          id?: string
          issued_at?: string
          issued_by: string
          template_id: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issued_certificates_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issued_certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          lesson_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          lesson_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_files_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          mandatory_attendance: boolean
          module_id: string
          order_index: number
          professor_name: string | null
          scheduled_date: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          mandatory_attendance?: boolean
          module_id: string
          order_index?: number
          professor_name?: string | null
          scheduled_date?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          mandatory_attendance?: boolean
          module_id?: string
          order_index?: number
          professor_name?: string | null
          scheduled_date?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          correct_option: number | null
          expected_text: string | null
          id: string
          options: Json
          order_index: number
          question: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          correct_option?: number | null
          expected_text?: string | null
          id?: string
          options?: Json
          order_index?: number
          question: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          correct_option?: number | null
          expected_text?: string | null
          id?: string
          options?: Json
          order_index?: number
          question?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          answers: Json
          id: string
          quiz_id: string
          score: number | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          id?: string
          quiz_id: string
          score?: number | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          id?: string
          quiz_id?: string
          score?: number | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          available_from: string | null
          available_until: string | null
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          lesson_id: string | null
          title: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          lesson_id?: string | null
          title: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lesson_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      tcc_settings: {
        Row: {
          accept_from: string | null
          course_id: string | null
          deadline: string | null
          id: string
          instructions: string | null
          template_name: string | null
          template_path: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          accept_from?: string | null
          course_id?: string | null
          deadline?: string | null
          id?: string
          instructions?: string | null
          template_name?: string | null
          template_path?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          accept_from?: string | null
          course_id?: string | null
          deadline?: string | null
          id?: string
          instructions?: string | null
          template_name?: string | null
          template_path?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "tcc_settings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tcc_submissions: {
        Row: {
          cohort_id: string
          created_at: string
          feedback: string | null
          file_name: string
          file_path: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          feedback?: string | null
          file_name: string
          file_path: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          feedback?: string | null
          file_name?: string
          file_path?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tcc_submissions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "professor" | "aluno" | "admin"
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
      app_role: ["professor", "aluno", "admin"],
    },
  },
} as const
