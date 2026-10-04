export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      answers: {
        Row: {
          created_at: string;
          id: string;
          instance_id: string;
          is_correct: boolean;
          marks_awarded: number;
          points: number;
          raw_answer: string;
          room_id: string | null;
          solo_session_id: string | null;
          time_ms: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          instance_id: string;
          is_correct: boolean;
          marks_awarded?: number;
          points?: number;
          raw_answer: string;
          room_id?: string | null;
          solo_session_id?: string | null;
          time_ms?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          instance_id?: string;
          is_correct?: boolean;
          marks_awarded?: number;
          points?: number;
          raw_answer?: string;
          room_id?: string | null;
          solo_session_id?: string | null;
          time_ms?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "answers_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: false;
            referencedRelation: "question_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_solo_session_id_fkey";
            columns: ["solo_session_id"];
            isOneToOne: false;
            referencedRelation: "solo_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_challenges: {
        Row: {
          challenge_date: string;
          instance_ids: string[];
          subject_id: number;
        };
        Insert: {
          challenge_date: string;
          instance_ids: string[];
          subject_id: number;
        };
        Update: {
          challenge_date?: string;
          instance_ids?: string[];
          subject_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "daily_challenges_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_boards: {
        Row: {
          id: number;
          name: string;
          slug: string;
        };
        Insert: {
          id?: never;
          name: string;
          slug: string;
        };
        Update: {
          id?: never;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar: string | null;
          created_at: string;
          exam_board_id: number | null;
          id: string;
          tier: string | null;
          username: string;
          xp: number;
        };
        Insert: {
          avatar?: string | null;
          created_at?: string;
          exam_board_id?: number | null;
          id: string;
          tier?: string | null;
          username: string;
          xp?: number;
        };
        Update: {
          avatar?: string | null;
          created_at?: string;
          exam_board_id?: number | null;
          id?: string;
          tier?: string | null;
          username?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_exam_board_id_fkey";
            columns: ["exam_board_id"];
            isOneToOne: false;
            referencedRelation: "exam_boards";
            referencedColumns: ["id"];
          },
        ];
      };
      question_boards: {
        Row: {
          exam_board_id: number;
          question_id: string;
        };
        Insert: {
          exam_board_id: number;
          question_id: string;
        };
        Update: {
          exam_board_id?: number;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_boards_exam_board_id_fkey";
            columns: ["exam_board_id"];
            isOneToOne: false;
            referencedRelation: "exam_boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_boards_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      question_instances: {
        Row: {
          calculator: string;
          created_at: string;
          generator_key: string | null;
          id: string;
          marks: number;
          public_payload: NonNullable<Json>;
          seed: number | null;
          source_question_id: string | null;
          subject_id: number;
          tier: string;
          topic_id: number;
        };
        Insert: {
          calculator: string;
          created_at?: string;
          generator_key?: string | null;
          id?: string;
          marks: number;
          public_payload: NonNullable<Json>;
          seed?: number | null;
          source_question_id?: string | null;
          subject_id: number;
          tier: string;
          topic_id: number;
        };
        Update: {
          calculator?: string;
          created_at?: string;
          generator_key?: string | null;
          id?: string;
          marks?: number;
          public_payload?: NonNullable<Json>;
          seed?: number | null;
          source_question_id?: string | null;
          subject_id?: number;
          tier?: string;
          topic_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "question_instances_source_question_id_fkey";
            columns: ["source_question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_instances_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_instances_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      question_secrets: {
        Row: {
          answer_spec: NonNullable<Json>;
          instance_id: string;
          solution: NonNullable<Json>;
        };
        Insert: {
          answer_spec: NonNullable<Json>;
          instance_id: string;
          solution: NonNullable<Json>;
        };
        Update: {
          answer_spec?: NonNullable<Json>;
          instance_id?: string;
          solution?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "question_secrets_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: true;
            referencedRelation: "question_instances";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          answer_spec: NonNullable<Json>;
          calculator: string;
          created_at: string;
          difficulty: number;
          id: string;
          marks: number;
          options: Json | null;
          prompt_md: string;
          solution_md: string;
          status: string;
          subject_id: number;
          tier: string;
          topic_id: number;
          type: string;
        };
        Insert: {
          answer_spec: NonNullable<Json>;
          calculator: string;
          created_at?: string;
          difficulty?: number;
          id?: string;
          marks?: number;
          options?: Json | null;
          prompt_md: string;
          solution_md: string;
          status?: string;
          subject_id: number;
          tier: string;
          topic_id: number;
          type: string;
        };
        Update: {
          answer_spec?: NonNullable<Json>;
          calculator?: string;
          created_at?: string;
          difficulty?: number;
          id?: string;
          marks?: number;
          options?: Json | null;
          prompt_md?: string;
          solution_md?: string;
          status?: string;
          subject_id?: number;
          tier?: string;
          topic_id?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      room_players: {
        Row: {
          answered_idx: number;
          joined_at: string;
          room_id: string;
          score: number;
          streak: number;
          user_id: string;
        };
        Insert: {
          answered_idx?: number;
          joined_at?: string;
          room_id: string;
          score?: number;
          streak?: number;
          user_id: string;
        };
        Update: {
          answered_idx?: number;
          joined_at?: string;
          room_id?: string;
          score?: number;
          streak?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_players_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_players_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      room_questions: {
        Row: {
          idx: number;
          instance_id: string;
          room_id: string;
        };
        Insert: {
          idx: number;
          instance_id: string;
          room_id: string;
        };
        Update: {
          idx?: number;
          instance_id?: string;
          room_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_questions_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: false;
            referencedRelation: "question_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_questions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          code: string | null;
          created_at: string;
          current_index: number;
          exam_board_id: number | null;
          host_id: string | null;
          id: string;
          last_activity_at: string;
          max_players: number;
          mode: string;
          question_count: number;
          question_ends_at: string | null;
          question_started_at: string | null;
          reveal_started_at: string | null;
          seconds_per_question: number;
          status: string;
          subject_id: number;
          tier: string;
          topic_ids: number[];
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          current_index?: number;
          exam_board_id?: number | null;
          host_id?: string | null;
          id?: string;
          last_activity_at?: string;
          max_players?: number;
          mode: string;
          question_count?: number;
          question_ends_at?: string | null;
          question_started_at?: string | null;
          reveal_started_at?: string | null;
          seconds_per_question?: number;
          status?: string;
          subject_id: number;
          tier: string;
          topic_ids?: number[];
        };
        Update: {
          code?: string | null;
          created_at?: string;
          current_index?: number;
          exam_board_id?: number | null;
          host_id?: string | null;
          id?: string;
          last_activity_at?: string;
          max_players?: number;
          mode?: string;
          question_count?: number;
          question_ends_at?: string | null;
          question_started_at?: string | null;
          reveal_started_at?: string | null;
          seconds_per_question?: number;
          status?: string;
          subject_id?: number;
          tier?: string;
          topic_ids?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "rooms_exam_board_id_fkey";
            columns: ["exam_board_id"];
            isOneToOne: false;
            referencedRelation: "exam_boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      solo_session_questions: {
        Row: {
          idx: number;
          instance_id: string;
          served_at: string;
          session_id: string;
        };
        Insert: {
          idx: number;
          instance_id: string;
          served_at?: string;
          session_id: string;
        };
        Update: {
          idx?: number;
          instance_id?: string;
          served_at?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "solo_session_questions_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: true;
            referencedRelation: "question_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solo_session_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "solo_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      solo_sessions: {
        Row: {
          finished_at: string | null;
          id: string;
          score: number;
          settings: NonNullable<Json>;
          started_at: string;
          streak_best: number;
          user_id: string;
        };
        Insert: {
          finished_at?: string | null;
          id?: string;
          score?: number;
          settings: NonNullable<Json>;
          started_at?: string;
          streak_best?: number;
          user_id: string;
        };
        Update: {
          finished_at?: string | null;
          id?: string;
          score?: number;
          settings?: NonNullable<Json>;
          started_at?: string;
          streak_best?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "solo_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solo_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          id: number;
          is_active: boolean;
          name: string;
          slug: string;
        };
        Insert: {
          id?: never;
          is_active?: boolean;
          name: string;
          slug: string;
        };
        Update: {
          id?: never;
          is_active?: boolean;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      topic_stats: {
        Row: {
          attempts: number;
          correct: number;
          last_seen: string | null;
          topic_id: number;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          correct?: number;
          last_seen?: string | null;
          topic_id: number;
          user_id: string;
        };
        Update: {
          attempts?: number;
          correct?: number;
          last_seen?: string | null;
          topic_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topic_stats_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      topics: {
        Row: {
          id: number;
          min_tier: string;
          name: string;
          needs_diagram: boolean;
          parent_id: number | null;
          slug: string;
          sort_order: number;
          strand: string | null;
          subject_id: number;
        };
        Insert: {
          id?: never;
          min_tier?: string;
          name: string;
          needs_diagram?: boolean;
          parent_id?: number | null;
          slug: string;
          sort_order?: number;
          strand?: string | null;
          subject_id: number;
        };
        Update: {
          id?: never;
          min_tier?: string;
          name?: string;
          needs_diagram?: boolean;
          parent_id?: number | null;
          slug?: string;
          sort_order?: number;
          strand?: string | null;
          subject_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "topics_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topics_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          avatar: string | null;
          id: string | null;
          username: string | null;
        };
        Insert: {
          avatar?: string | null;
          id?: string | null;
          username?: string | null;
        };
        Update: {
          avatar?: string | null;
          id?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_room: {
        Args: {
          p_code: string;
          p_exam_board_id: number;
          p_host_id: string;
          p_mode: string;
          p_questions: Json;
          p_seconds_per_question: number;
          p_subject_id: number;
          p_tier: string;
          p_topic_ids: number[];
        };
        Returns: string;
      };
      expire_idle_rooms: { Args: Record<PropertyKey, never>; Returns: number };
      finalize_question: { Args: { p_idx: number; p_room_id: string }; Returns: boolean };
      join_room: { Args: { p_room_id: string; p_user_id: string }; Returns: number };
      leaderboard_week_start: { Args: Record<PropertyKey, never>; Returns: string };
      leave_room: { Args: { p_room_id: string; p_user_id: string }; Returns: undefined };
      next_question: { Args: { p_idx: number; p_room_id: string }; Returns: boolean };
      played_with: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar: string;
          id: string;
          username: string;
        }[];
      };
      record_room_answer: {
        Args: {
          p_idx: number;
          p_instance_id: string;
          p_is_correct: boolean;
          p_marks_awarded: number;
          p_points: number;
          p_raw_answer: string;
          p_room_id: string;
          p_time_ms: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      record_solo_answer: {
        Args: {
          p_finish: boolean;
          p_instance_id: string;
          p_is_correct: boolean;
          p_marks_awarded: number;
          p_points: number;
          p_raw_answer: string;
          p_session_id: string;
          p_streak: number;
          p_time_ms: number;
          p_topic_id: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      serve_solo_question: {
        Args: {
          p_answer_spec: Json;
          p_calculator: string;
          p_generator_key: string;
          p_idx: number;
          p_marks: number;
          p_public_payload: Json;
          p_seed: number;
          p_session_id: string;
          p_solution: Json;
          p_subject_id: number;
          p_tier: string;
          p_topic_id: number;
        };
        Returns: string;
      };
      start_room: { Args: { p_room_id: string; p_user_id: string }; Returns: boolean };
      weekly_leaderboard: {
        Args: { p_limit?: number; p_scope?: string };
        Returns: {
          avatar: string;
          id: string;
          is_me: boolean;
          points: number;
          rank: number;
          username: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
