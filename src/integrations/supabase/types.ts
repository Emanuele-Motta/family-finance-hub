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
      accounts: {
        Row: {
          balance: number
          created_at: string
          family_group_id: string
          id: string
          is_primary: boolean
          name: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          family_group_id: string
          id?: string
          is_primary?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          family_group_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      anomalies: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          analysis: Json | null
          anomaly_type: string
          confidence: number
          created_at: string
          description: string
          family_group_id: string
          id: string
          is_acknowledged: boolean
          severity: string
          transaction_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          analysis?: Json | null
          anomaly_type: string
          confidence?: number
          created_at?: string
          description: string
          family_group_id: string
          id?: string
          is_acknowledged?: boolean
          severity?: string
          transaction_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          analysis?: Json | null
          anomaly_type?: string
          confidence?: number
          created_at?: string
          description?: string
          family_group_id?: string
          id?: string
          is_acknowledged?: boolean
          severity?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomalies_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalies_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          family_group_id: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          family_group_id: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          family_group_id?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          family_group_id: string
          id: string
          period: Database["public"]["Enums"]["budget_period"]
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          family_group_id: string
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          family_group_id?: string
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_forecasts: {
        Row: {
          account_id: string
          calculation_method: string
          confidence_level: string
          created_at: string
          current_balance: number
          family_group_id: string
          forecast_balance: number
          forecast_date: string
          forecast_days: number
          id: string
          metadata: Json | null
          projected_expenses: number
          projected_income: number
        }
        Insert: {
          account_id: string
          calculation_method: string
          confidence_level?: string
          created_at?: string
          current_balance: number
          family_group_id: string
          forecast_balance: number
          forecast_date: string
          forecast_days: number
          id?: string
          metadata?: Json | null
          projected_expenses?: number
          projected_income?: number
        }
        Update: {
          account_id?: string
          calculation_method?: string
          confidence_level?: string
          created_at?: string
          current_balance?: number
          family_group_id?: string
          forecast_balance?: number
          forecast_date?: string
          forecast_days?: number
          id?: string
          metadata?: Json | null
          projected_expenses?: number
          projected_income?: number
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_forecasts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_forecasts_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          family_group_id: string | null
          icon: string
          id: string
          is_default: boolean
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          color?: string
          created_at?: string
          family_group_id?: string | null
          icon?: string
          id?: string
          is_default?: boolean
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          color?: string
          created_at?: string
          family_group_id?: string | null
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "categories_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          due_date: string | null
          family_group_id: string
          id: string
          interest_rate: number | null
          is_paid: boolean
          monthly_payment: number | null
          name: string
          notes: string | null
          remaining_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          family_group_id: string
          id?: string
          interest_rate?: number | null
          is_paid?: boolean
          monthly_payment?: number | null
          name: string
          notes?: string | null
          remaining_amount: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          family_group_id?: string
          id?: string
          interest_rate?: number | null
          is_paid?: boolean
          monthly_payment?: number | null
          name?: string
          notes?: string | null
          remaining_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_group_id: string
          id: string
          role: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_group_id: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_group_id?: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          current_amount: number
          deadline: string | null
          family_group_id: string
          id: string
          name: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          family_group_id: string
          id?: string
          name: string
          target_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          deadline?: string | null
          family_group_id?: string
          id?: string
          name?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          account_id: string
          created_at: string
          family_group_id: string
          id: string
          import_source: string
          imported_by: string
          metadata: Json | null
          processed_rows: number
          status: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          family_group_id: string
          id?: string
          import_source: string
          imported_by: string
          metadata?: Json | null
          processed_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          family_group_id?: string
          id?: string
          import_source?: string
          imported_by?: string
          metadata?: Json | null
          processed_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      import_pending_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          date: string
          description: string
          duplicate_score: number | null
          family_group_id: string
          id: string
          import_batch_id: string
          is_reviewed: boolean
          matched_transaction_id: string | null
          notes: string | null
          raw_data: Json
          reviewed_by: string | null
          row_index: number
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          date: string
          description: string
          duplicate_score?: number | null
          family_group_id: string
          id?: string
          import_batch_id: string
          is_reviewed?: boolean
          matched_transaction_id?: string | null
          notes?: string | null
          raw_data: Json
          reviewed_by?: string | null
          row_index: number
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          duplicate_score?: number | null
          family_group_id?: string
          id?: string
          import_batch_id?: string
          is_reviewed?: boolean
          matched_transaction_id?: string | null
          notes?: string | null
          raw_data?: Json
          reviewed_by?: string | null
          row_index?: number
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_pending_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_pending_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_pending_transactions_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_pending_transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_pending_transactions_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          delivery_channels: string[]
          family_group_id: string
          id: string
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          sent_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_channels?: string[]
          family_group_id: string
          id?: string
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_channels?: string[]
          family_group_id?: string
          id?: string
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          language: string
          preferred_currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          preferred_currency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          preferred_currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reconciliations: {
        Row: {
          confirmed_by: string | null
          created_at: string
          family_group_id: string
          id: string
          import_transaction_id: string
          is_duplicate: boolean
          match_confidence: number
          match_method: string
          match_score_details: Json | null
          matched_transaction_id: string | null
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string
          family_group_id: string
          id?: string
          import_transaction_id: string
          is_duplicate?: boolean
          match_confidence?: number
          match_method: string
          match_score_details?: Json | null
          matched_transaction_id?: string | null
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string
          family_group_id?: string
          id?: string
          import_transaction_id?: string
          is_duplicate?: boolean
          match_confidence?: number
          match_method?: string
          match_score_details?: Json | null
          matched_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_import_transaction_id_fkey"
            columns: ["import_transaction_id"]
            isOneToOne: false
            referencedRelation: "import_pending_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      record_versions: {
        Row: {
          change_reason: string | null
          changed_by: string
          created_at: string
          data: Json
          family_group_id: string
          id: string
          record_id: string
          record_type: string
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          created_at?: string
          data: Json
          family_group_id: string
          id?: string
          record_id: string
          record_type: string
          version_number: number
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          data?: Json
          family_group_id?: string
          id?: string
          record_id?: string
          record_type?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "record_versions_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_occurrences: {
        Row: {
          created_at: string
          family_group_id: string
          id: string
          occurrence_date: string
          skip_reason: string | null
          status: string
          template_id: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          family_group_id: string
          id?: string
          occurrence_date: string
          skip_reason?: string | null
          status?: string
          template_id: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          family_group_id?: string
          id?: string
          occurrence_date?: string
          skip_reason?: string | null
          status?: string
          template_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_occurrences_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_occurrences_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_occurrences_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_templates: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          day_of_month: number | null
          day_of_week: string | null
          description: string | null
          ends_at: string | null
          family_group_id: string
          frequency: string
          id: string
          interval: number
          is_active: boolean
          max_occurrences: number | null
          months: string[] | null
          name: string
          notify_days_before: number | null
          notify_method: string | null
          starts_at: string | null
          tags: string[] | null
          to_account_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          day_of_month?: number | null
          day_of_week?: string | null
          description?: string | null
          ends_at?: string | null
          family_group_id: string
          frequency: string
          id?: string
          interval?: number
          is_active?: boolean
          max_occurrences?: number | null
          months?: string[] | null
          name: string
          notify_days_before?: number | null
          notify_method?: string | null
          starts_at?: string | null
          tags?: string[] | null
          to_account_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          day_of_week?: string | null
          description?: string | null
          ends_at?: string | null
          family_group_id?: string
          frequency?: string
          id?: string
          interval?: number
          is_active?: boolean
          max_occurrences?: number | null
          months?: string[] | null
          name?: string
          notify_days_before?: number | null
          notify_method?: string | null
          starts_at?: string | null
          tags?: string[] | null
          to_account_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_templates_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_templates_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_applications: {
        Row: {
          applied_at: string
          family_group_id: string
          id: string
          rule_id: string
          transaction_id: string
        }
        Insert: {
          applied_at?: string
          family_group_id: string
          id?: string
          rule_id: string
          transaction_id: string
        }
        Update: {
          applied_at?: string
          family_group_id?: string
          id?: string
          rule_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_applications_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_applications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "transaction_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_applications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          family_group_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          family_group_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          family_group_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_links: {
        Row: {
          created_at: string
          family_group_id: string
          id: string
          linked_at: string
          telegram_id: string
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          family_group_id: string
          id?: string
          linked_at?: string
          telegram_id: string
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          family_group_id?: string
          id?: string
          linked_at?: string
          telegram_id?: string
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_links_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_approvals: {
        Row: {
          approval_reason: string | null
          approval_threshold: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          family_group_id: string
          id: string
          requested_by: string
          status: string
          transaction_id: string
        }
        Insert: {
          approval_reason?: string | null
          approval_threshold: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          family_group_id: string
          id?: string
          requested_by: string
          status?: string
          transaction_id: string
        }
        Update: {
          approval_reason?: string | null
          approval_threshold?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          family_group_id?: string
          id?: string
          requested_by?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_approvals_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_approvals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_audit: {
        Row: {
          action: string
          created_at: string
          family_group_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          transaction_id: string | null
          trigger_source: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          family_group_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          transaction_id?: string | null
          trigger_source?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          family_group_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          transaction_id?: string | null
          trigger_source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_audit_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_audit_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_comments: {
        Row: {
          content: string
          created_at: string
          family_group_id: string
          id: string
          is_settlement_comment: boolean
          is_system_comment: boolean
          settled_between_user_a: string | null
          settled_between_user_b: string | null
          settlement_amount: number | null
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          family_group_id: string
          id?: string
          is_settlement_comment?: boolean
          is_system_comment?: boolean
          settled_between_user_a?: string | null
          settled_between_user_b?: string | null
          settlement_amount?: number | null
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          family_group_id?: string
          id?: string
          is_settlement_comment?: boolean
          is_system_comment?: boolean
          settled_between_user_a?: string | null
          settled_between_user_b?: string | null
          settlement_amount?: number | null
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_comments_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_comments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_refunds: {
        Row: {
          created_at: string
          created_by: string | null
          family_group_id: string
          id: string
          original_transaction_id: string
          reason: string | null
          refund_transaction_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_group_id: string
          id?: string
          original_transaction_id: string
          reason?: string | null
          refund_transaction_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_group_id?: string
          id?: string
          original_transaction_id?: string
          reason?: string | null
          refund_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_refunds_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_refunds_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_refunds_refund_transaction_id_fkey"
            columns: ["refund_transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_rules: {
        Row: {
          account_id: string | null
          auto_apply: boolean
          category_id: string | null
          condition_logic: string
          condition_type: string
          conditions: Json
          created_at: string
          created_by: string
          description: string | null
          family_group_id: string
          id: string
          is_active: boolean
          name: string
          priority: number
          require_review: boolean
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          auto_apply?: boolean
          category_id?: string | null
          condition_logic?: string
          condition_type: string
          conditions: Json
          created_at?: string
          created_by: string
          description?: string | null
          family_group_id: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          require_review?: boolean
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          auto_apply?: boolean
          category_id?: string | null
          condition_logic?: string
          condition_type?: string
          conditions?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          family_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          require_review?: boolean
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_splits: {
        Row: {
          created_at: string
          id: string
          is_advance: boolean
          share_amount: number
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_advance?: boolean
          share_amount: number
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_advance?: boolean
          share_amount?: number
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          created_by_user_id: string
          date: string
          family_group_id: string
          id: string
          notes: string | null
          paid_by_user_id: string | null
          recurrence_type: Database["public"]["Enums"]["recurrence_type"] | null
          recurring: boolean
          tags: string[] | null
          to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          created_by_user_id: string
          date?: string
          family_group_id: string
          id?: string
          notes?: string | null
          paid_by_user_id?: string | null
          recurrence_type?:
            | Database["public"]["Enums"]["recurrence_type"]
            | null
          recurring?: boolean
          tags?: string[] | null
          to_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by_user_id?: string
          date?: string
          family_group_id?: string
          id?: string
          notes?: string | null
          paid_by_user_id?: string | null
          recurrence_type?:
            | Database["public"]["Enums"]["recurrence_type"]
            | null
          recurring?: boolean
          tags?: string[] | null
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_family_group: { Args: { _name: string }; Returns: string }
      create_record_version: {
        Args: {
          _change_reason?: string
          _data: Json
          _family_group_id: string
          _record_id: string
          _record_type: string
        }
        Returns: number
      }
      get_user_family_ids: { Args: { _user_id: string }; Returns: string[] }
      is_family_admin: {
        Args: { _family_group_id: string; _user_id: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_name?: string
          _entity_type: string
          _family_group_id: string
          _new_values?: Json
          _old_values?: Json
        }
        Returns: string
      }
      log_transaction_audit: {
        Args: {
          _action: string
          _family_group_id: string
          _new_values: Json
          _old_values: Json
          _transaction_id: string
          _trigger_source?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      budget_period: "monthly" | "yearly"
      family_role: "admin" | "member"
      recurrence_type: "monthly" | "yearly"
      transaction_type: "income" | "expense" | "transfer"
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
      budget_period: ["monthly", "yearly"],
      family_role: ["admin", "member"],
      recurrence_type: ["monthly", "yearly"],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const
