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
      achievements: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          beneficiary: string | null
          collected_amount: number
          completed_at: string | null
          cover_image: string | null
          created_at: string
          crop_settings: Json | null
          deleted_at: string | null
          full_description: string | null
          id: string
          purpose: string | null
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          target_amount: number
          title: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          beneficiary?: string | null
          collected_amount?: number
          completed_at?: string | null
          cover_image?: string | null
          created_at?: string
          crop_settings?: Json | null
          deleted_at?: string | null
          full_description?: string | null
          id?: string
          purpose?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          target_amount?: number
          title: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          beneficiary?: string | null
          collected_amount?: number
          completed_at?: string | null
          cover_image?: string | null
          created_at?: string
          crop_settings?: Json | null
          deleted_at?: string | null
          full_description?: string | null
          id?: string
          purpose?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          target_amount?: number
          title?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          billing_cycle_key: string | null
          campaign_id: string | null
          created_at: string
          currency: string
          donor_email: string | null
          donor_name: string | null
          donor_phone: string | null
          id: string
          is_anonymous: boolean
          is_recurring: boolean
          paid_at: string | null
          payment_id: string | null
          payment_method_type: string | null
          payment_provider: string
          payment_type: string
          status: string
          user_id: string | null
          yookassa_payment_id: string | null
        }
        Insert: {
          amount: number
          billing_cycle_key?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          id?: string
          is_anonymous?: boolean
          is_recurring?: boolean
          paid_at?: string | null
          payment_id?: string | null
          payment_method_type?: string | null
          payment_provider?: string
          payment_type?: string
          status?: string
          user_id?: string | null
          yookassa_payment_id?: string | null
        }
        Update: {
          amount?: number
          billing_cycle_key?: string | null
          campaign_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          id?: string
          is_anonymous?: boolean
          is_recurring?: boolean
          paid_at?: string | null
          payment_id?: string | null
          payment_method_type?: string | null
          payment_provider?: string
          payment_type?: string
          status?: string
          user_id?: string | null
          yookassa_payment_id?: string | null
        }
        Relationships: []
      }
      donor_link_audit: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      donor_notes: {
        Row: {
          created_at: string
          created_by: string | null
          donor_email: string | null
          donor_key: string
          donor_phone: string | null
          donor_user_id: string | null
          id: string
          note: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          donor_email?: string | null
          donor_key: string
          donor_phone?: string | null
          donor_user_id?: string | null
          id?: string
          note: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          donor_email?: string | null
          donor_key?: string
          donor_phone?: string | null
          donor_user_id?: string | null
          id?: string
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      donor_subscriptions: {
        Row: {
          amount: number
          campaign_id: string | null
          canceled_at: string | null
          card_expiry: string | null
          card_last4: string | null
          card_type: string | null
          created_at: string
          currency: string
          current_billing_key: string | null
          external_subscription_id: string | null
          id: string
          interval: string
          last_charge_at: string | null
          last_failure_code: string | null
          last_failure_reason: string | null
          last_retry_at: string | null
          next_payment_at: string | null
          paused_at: string | null
          paused_reason: string | null
          payment_method_id: string | null
          payment_method_saved_at: string | null
          payment_method_type: string | null
          processing_at: string | null
          retry_count: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          canceled_at?: string | null
          card_expiry?: string | null
          card_last4?: string | null
          card_type?: string | null
          created_at?: string
          currency?: string
          current_billing_key?: string | null
          external_subscription_id?: string | null
          id?: string
          interval?: string
          last_charge_at?: string | null
          last_failure_code?: string | null
          last_failure_reason?: string | null
          last_retry_at?: string | null
          next_payment_at?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          payment_method_id?: string | null
          payment_method_saved_at?: string | null
          payment_method_type?: string | null
          processing_at?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          canceled_at?: string | null
          card_expiry?: string | null
          card_last4?: string | null
          card_type?: string | null
          created_at?: string
          currency?: string
          current_billing_key?: string | null
          external_subscription_id?: string | null
          id?: string
          interval?: string
          last_charge_at?: string | null
          last_failure_code?: string | null
          last_failure_reason?: string | null
          last_retry_at?: string | null
          next_payment_at?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          payment_method_id?: string | null
          payment_method_saved_at?: string | null
          payment_method_type?: string | null
          processing_at?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_subscriptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      news: {
        Row: {
          content: string | null
          cover_image: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_public_donor: boolean
          link_email_attempts: number
          link_email_code_hash: string | null
          link_email_expires_at: string | null
          link_email_last_requested_at: string | null
          phone: string | null
          public_display_name: string | null
          updated_at: string
          user_id: string
          wants_notifications: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_public_donor?: boolean
          link_email_attempts?: number
          link_email_code_hash?: string | null
          link_email_expires_at?: string | null
          link_email_last_requested_at?: string | null
          phone?: string | null
          public_display_name?: string | null
          updated_at?: string
          user_id: string
          wants_notifications?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_public_donor?: boolean
          link_email_attempts?: number
          link_email_code_hash?: string | null
          link_email_expires_at?: string | null
          link_email_last_requested_at?: string | null
          phone?: string | null
          public_display_name?: string | null
          updated_at?: string
          user_id?: string
          wants_notifications?: boolean
        }
        Relationships: []
      }
      recurring_cron_heartbeats: {
        Row: {
          job: string
          last_payload: Json | null
          last_run_at: string
          last_status: string | null
        }
        Insert: {
          job: string
          last_payload?: Json | null
          last_run_at?: string
          last_status?: string | null
        }
        Update: {
          job?: string
          last_payload?: Json | null
          last_run_at?: string
          last_status?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          category: string | null
          created_at: string
          file_url: string | null
          id: string
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      subscription_charge_attempts: {
        Row: {
          billing_cycle_key: string | null
          created_at: string
          donation_id: string | null
          error_code: string | null
          error_description: string | null
          id: string
          metadata: Json | null
          status: string
          subscription_id: string
          yookassa_payment_id: string | null
        }
        Insert: {
          billing_cycle_key?: string | null
          created_at?: string
          donation_id?: string | null
          error_code?: string | null
          error_description?: string | null
          id?: string
          metadata?: Json | null
          status: string
          subscription_id: string
          yookassa_payment_id?: string | null
        }
        Update: {
          billing_cycle_key?: string | null
          created_at?: string
          donation_id?: string | null
          error_code?: string | null
          error_description?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          subscription_id?: string
          yookassa_payment_id?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          subscription_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          subscription_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          subscription_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          awarded_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          awarded_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          awarded_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          donation_id: string | null
          event: string | null
          id: string
          object_id: string | null
          object_status: string | null
          payload: Json
          provider: string
          result: string | null
          source_ip: string | null
        }
        Insert: {
          created_at?: string
          donation_id?: string | null
          event?: string | null
          id?: string
          object_id?: string | null
          object_status?: string | null
          payload: Json
          provider?: string
          result?: string | null
          source_ip?: string | null
        }
        Update: {
          created_at?: string
          donation_id?: string | null
          event?: string | null
          id?: string
          object_id?: string | null
          object_status?: string | null
          payload?: Json
          provider?: string
          result?: string | null
          source_ip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      donations_total: {
        Row: {
          total_raised: number | null
        }
        Relationships: []
      }
      public_donations: {
        Row: {
          amount: number | null
          campaign_id: string | null
          created_at: string | null
          donor_name: string | null
          id: string | null
          is_anonymous: boolean | null
          paid_at: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          campaign_id?: string | null
          created_at?: string | null
          donor_name?: never
          id?: string | null
          is_anonymous?: boolean | null
          paid_at?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          campaign_id?: string | null
          created_at?: string | null
          donor_name?: never
          id?: string | null
          is_anonymous?: boolean | null
          paid_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _hash_link_code: { Args: { _code: string }; Returns: string }
      admin_recent_test_events: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          subscription_id: string
        }[]
      }
      admin_recurring_metrics: { Args: never; Returns: Json }
      admin_recurring_readiness: { Args: never; Returns: Json }
      admin_recurring_timeseries: {
        Args: { _days?: number }
        Returns: {
          attempts: number
          day: string
          failed: number
          succeeded: number
        }[]
      }
      confirm_link_donations: {
        Args: { _code: string; _user_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      donor_cancel_subscription: { Args: { _id: string }; Returns: undefined }
      donor_my_charge_attempts: {
        Args: { _limit?: number; _subscription_id: string }
        Returns: {
          created_at: string
          donation_id: string
          error_code: string
          error_description: string
          id: string
          metadata: Json
          status: string
          yookassa_payment_id: string
        }[]
      }
      donor_my_subscriptions: {
        Args: never
        Returns: {
          amount: number
          campaign_id: string
          card_expiry: string
          card_last4: string
          card_type: string
          created_at: string
          currency: string
          frequency: string
          id: string
          last_charge_at: string
          next_payment_at: string
          paused_reason: string
          status: string
        }[]
      }
      donor_pause_subscription: { Args: { _id: string }; Returns: undefined }
      donor_resume_subscription: { Args: { _id: string }; Returns: undefined }
      donor_retry_subscription_now: {
        Args: { _id: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      evaluate_user_achievements: {
        Args: { _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_campaign_collected: {
        Args: { _amount: number; _campaign_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      request_link_donations_code: {
        Args: { _user_id: string }
        Returns: string
      }
      reset_test_data: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
