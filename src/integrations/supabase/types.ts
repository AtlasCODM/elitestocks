export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      copy_trades: {
        Row: {
          amount: number;
          asset: Database["public"]["Enums"]["asset_type"];
          completed_at: string | null;
          calculation_interval: "hourly" | "daily";
          config_version: number | null;
          credited_profit: number;
          created_at: string;
          duration_days: number;
          id: string;
          matures_at: string;
          performance_status: string;
          profit_pct: number;
          status: Database["public"]["Enums"]["investment_status"];
          trader_id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          asset?: Database["public"]["Enums"]["asset_type"];
          completed_at?: string | null;
          calculation_interval?: "hourly" | "daily";
          config_version?: number | null;
          credited_profit?: number;
          created_at?: string;
          duration_days: number;
          id?: string;
          matures_at: string;
          performance_status?: string;
          profit_pct: number;
          status?: Database["public"]["Enums"]["investment_status"];
          trader_id: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          asset?: Database["public"]["Enums"]["asset_type"];
          completed_at?: string | null;
          calculation_interval?: "hourly" | "daily";
          config_version?: number | null;
          credited_profit?: number;
          created_at?: string;
          duration_days?: number;
          id?: string;
          matures_at?: string;
          performance_status?: string;
          profit_pct?: number;
          status?: Database["public"]["Enums"]["investment_status"];
          trader_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "copy_trades_trader_id_fkey";
            columns: ["trader_id"];
            isOneToOne: false;
            referencedRelation: "traders";
            referencedColumns: ["id"];
          },
        ];
      };
      investments: {
        Row: {
          amount: number;
          asset: Database["public"]["Enums"]["asset_type"];
          completed_at: string | null;
          calculation_interval: "hourly" | "daily";
          config_version: number | null;
          credited_profit: number;
          created_at: string;
          duration_days: number;
          id: string;
          matures_at: string;
          performance_status: string;
          plan_tier: string;
          profit_pct: number;
          status: Database["public"]["Enums"]["investment_status"];
          user_id: string;
        };
        Insert: {
          amount: number;
          asset?: Database["public"]["Enums"]["asset_type"];
          completed_at?: string | null;
          calculation_interval?: "hourly" | "daily";
          config_version?: number | null;
          credited_profit?: number;
          created_at?: string;
          duration_days: number;
          id?: string;
          matures_at: string;
          performance_status?: string;
          plan_tier: string;
          profit_pct: number;
          status?: Database["public"]["Enums"]["investment_status"];
          user_id: string;
        };
        Update: {
          amount?: number;
          asset?: Database["public"]["Enums"]["asset_type"];
          completed_at?: string | null;
          calculation_interval?: "hourly" | "daily";
          config_version?: number | null;
          credited_profit?: number;
          created_at?: string;
          duration_days?: number;
          id?: string;
          matures_at?: string;
          performance_status?: string;
          plan_tier?: string;
          profit_pct?: number;
          status?: Database["public"]["Enums"]["investment_status"];
          user_id?: string;
        };
        Relationships: [];
      };
      investment_engine_config: {
        Row: {
          id: boolean;
          config: Json;
          version: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          config: Json;
          version: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          config?: Json;
          version?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      investment_engine_audit: {
        Row: {
          id: string;
          actor_id: string | null;
          old_config: Json;
          new_config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          old_config: Json;
          new_config: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          old_config?: Json;
          new_config?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      investment_engine_performance: {
        Row: {
          id: string;
          actor_id: string;
          kind: string;
          position_id: string;
          profit: number;
          evidence_ref: string;
          contract_ref: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          kind: string;
          position_id: string;
          profit: number;
          evidence_ref: string;
          contract_ref: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          kind?: string;
          position_id?: string;
          profit?: number;
          evidence_ref?: string;
          contract_ref?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: boolean;
          wallet_address: string;
          bitcoin_wallet_address: string;
          ethereum_wallet_address: string;
          solana_wallet_address: string;
          usdt_wallet_address: string;
          min_withdrawal: number;
          max_withdrawal: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          wallet_address?: string;
          bitcoin_wallet_address?: string;
          ethereum_wallet_address?: string;
          solana_wallet_address?: string;
          usdt_wallet_address?: string;
          min_withdrawal?: number;
          max_withdrawal?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          wallet_address?: string;
          bitcoin_wallet_address?: string;
          ethereum_wallet_address?: string;
          solana_wallet_address?: string;
          usdt_wallet_address?: string;
          min_withdrawal?: number;
          max_withdrawal?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          status?: string;
        };
        Relationships: [];
      };
      traders: {
        Row: {
          aum: string | null;
          badge: string | null;
          created_at: string;
          duration_days: number;
          followers: number;
          handle: string;
          id: string;
          name: string;
          profit_pct: number;
          risk_level: string;
          roi: number;
          win_rate: number;
        };
        Insert: {
          aum?: string | null;
          badge?: string | null;
          created_at?: string;
          duration_days: number;
          followers?: number;
          handle: string;
          id?: string;
          name: string;
          profit_pct: number;
          risk_level: string;
          roi: number;
          win_rate: number;
        };
        Update: {
          aum?: string | null;
          badge?: string | null;
          created_at?: string;
          duration_days?: number;
          followers?: number;
          handle?: string;
          id?: string;
          name?: string;
          profit_pct?: number;
          risk_level?: string;
          roi?: number;
          win_rate?: number;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          address: string | null;
          amount: number;
          asset: Database["public"]["Enums"]["asset_type"];
          created_at: string;
          id: string;
          metadata: Json;
          reference_id: string | null;
          status: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          amount: number;
          asset: Database["public"]["Enums"]["asset_type"];
          created_at?: string;
          id?: string;
          metadata?: Json;
          reference_id?: string | null;
          status: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string | null;
          amount?: number;
          asset?: Database["public"]["Enums"]["asset_type"];
          created_at?: string;
          id?: string;
          metadata?: Json;
          reference_id?: string | null;
          status?: Database["public"]["Enums"]["tx_status"];
          type?: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          asset: Database["public"]["Enums"]["asset_type"];
          balance: number;
          locked: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset: Database["public"]["Enums"]["asset_type"];
          balance?: number;
          locked?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset?: Database["public"]["Enums"]["asset_type"];
          balance?: number;
          locked?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      engine_update_configuration: {
        Args: { p_actor_id: string; p_expected_version: number; p_config: Json };
        Returns: Json;
      };
      engine_create_investment: {
        Args: { p_user_id: string; p_tier: string; p_amount: number | string };
        Returns: Json;
      };
      engine_create_copy_trade: {
        Args: { p_user_id: string; p_trader_id: string; p_amount: number | string };
        Returns: Json;
      };
      engine_confirm_deposit: {
        Args: {
          p_user_id: string;
          p_asset: Database["public"]["Enums"]["asset_type"];
          p_amount: number | string;
        };
        Returns: Json;
      };
      engine_create_withdrawal: {
        Args: {
          p_user_id: string;
          p_asset: Database["public"]["Enums"]["asset_type"];
          p_amount: number | string;
          p_address: string;
        };
        Returns: Json;
      };
      engine_cancel_position: {
        Args: { p_user_id: string; p_position_id: string; p_kind: string };
        Returns: Json;
      };
      engine_record_performance: {
        Args: {
          p_actor_id: string;
          p_kind: string;
          p_position_id: string;
          p_profit: number | string;
          p_evidence_ref: string;
          p_contract_ref: string;
        };
        Returns: Json;
      };
      engine_process_jobs: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
    };
    Enums: {
      asset_type: "BTC" | "ETH" | "SOL" | "USDT";
      investment_status: "active" | "matured" | "cancelled";
      tx_status:
        | "pending_confirmation"
        | "verifying"
        | "confirmed"
        | "pending"
        | "processing"
        | "successful"
        | "completed"
        | "failed"
        | "cancelled";
      tx_type: "deposit" | "withdrawal" | "investment" | "return" | "copy_trade" | "copy_return";
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      asset_type: ["BTC", "ETH", "SOL", "USDT"],
      investment_status: ["active", "matured", "cancelled"],
      tx_status: [
        "pending_confirmation",
        "verifying",
        "confirmed",
        "pending",
        "processing",
        "successful",
        "completed",
        "failed",
        "cancelled",
      ],
      tx_type: ["deposit", "withdrawal", "investment", "return", "copy_trade", "copy_return"],
    },
  },
} as const;
