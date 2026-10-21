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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id?: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          receiver_id: string
          sender_id?: string
          status?: string
        }
        Update: {
          created_at?: string
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          caption: string | null
          created_at: string
          favorite: boolean
          file_name: string | null
          file_path: string | null
          file_type: string | null
          id: string
          tags: string[]
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          favorite?: boolean
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          tags?: string[]
          user_id?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          favorite?: boolean
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment: Json | null
          content: string
          created_at: string
          id: string
          kind: string
          plan: Json | null
          plan_status: string | null
          pushed_at: string | null
          reactions: Json
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachment?: Json | null
          content: string
          created_at?: string
          id?: string
          kind?: string
          plan?: Json | null
          plan_status?: string | null
          pushed_at?: string | null
          reactions?: Json
          read_at?: string | null
          recipient_id: string
          sender_id?: string
        }
        Update: {
          attachment?: Json | null
          content?: string
          created_at?: string
          id?: string
          kind?: string
          plan?: Json | null
          plan_status?: string | null
          pushed_at?: string | null
          reactions?: Json
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          bio: string | null
          display_name: string | null
          id: string
          last_active: string | null
          streak: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          display_name?: string | null
          id: string
          last_active?: string | null
          streak?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string
          last_active?: string | null
          streak?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      task_shares: {
        Row: {
          created_at: string
          owner_id: string
          status: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          status?: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          status?: string
          viewer_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          notes: string | null
          priority: string
          push_sent_for: string | null
          recurrence: string
          remind_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          push_sent_for?: string | null
          recurrence?: string
          remind_at?: string | null
          title: string
          user_id?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          push_sent_for?: string | null
          recurrence?: string
          remind_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      checklist_update: {
        Args: { _add: string; _item: string; _msg: string }
        Returns: Json
      }
      follow_list: {
        Args: { _id: string; _tab: string }
        Returns: {
          bio: string
          display_name: string
          id: string
          last_active: string
          streak: number
          username: string
        }[]
      }
      get_avatars: {
        Args: { _ids: string[] }
        Returns: {
          avatar: string
          id: string
        }[]
      }
      incoming_friend_requests: {
        Args: never
        Returns: {
          bio: string
          display_name: string
          id: string
          last_active: string
          streak: number
          username: string
        }[]
      }
      is_connected: { Args: { _other: string }; Returns: boolean }
      public_profile: {
        Args: { _id: string }
        Returns: {
          bio: string
          display_name: string
          followers: number
          following: number
          id: string
          last_active: string
          streak: number
          username: string
        }[]
      }
      react_message: { Args: { _emoji: string; _msg: string }; Returns: Json }
      recent_followers: {
        Args: never
        Returns: {
          bio: string
          display_name: string
          followed_at: string
          follows_back: boolean
          id: string
          last_active: string
          streak: number
          username: string
        }[]
      }
      respond_friend_request: {
        Args: { _accept: boolean; _sender: string }
        Returns: undefined
      }
      respond_plan: {
        Args: { _accept: boolean; _msg: string }
        Returns: string
      }
      search_profiles: {
        Args: { _q: string }
        Returns: {
          bio: string
          display_name: string
          id: string
          last_active: string
          streak: number
          username: string
        }[]
      }
      unfriend: { Args: { _other: string }; Returns: undefined }
      username_available: { Args: { _name: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
