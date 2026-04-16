export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferred_currency: string;
  language: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  invite_code: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  family_group_id: string;
  role: 'admin' | 'member';
}

export interface Category {
  id: string;
  family_group_id: string | null;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  color: string;
  is_default: boolean;
}

export interface Transaction {
  id: string;
  family_group_id: string;
  user_id: string;
  created_by_user_id: string;
  paid_by_user_id: string | null;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  notes: string | null;
  recurring: boolean;
  recurrence_type: 'monthly' | 'yearly' | null;
  tags: string[] | null;
  created_at: string;
}

export interface Account {
  id: string;
  family_group_id: string;
  name: string;
  balance: number;
  is_primary: boolean;
}

export interface Budget {
  id: string;
  family_group_id: string;
  category_id: string | null;
  amount: number;
  period: 'monthly' | 'yearly';
}

export interface Goal {
  id: string;
  family_group_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

export interface Debt {
  id: string;
  family_group_id: string;
  name: string;
  total_amount: number;
  remaining_amount: number;
  due_date: string | null;
  interest_rate: number | null;
  monthly_payment: number | null;
  notes: string | null;
  is_paid: boolean;
}

// ============================================================================
// AUDIT & VERSIONING
// ============================================================================

export interface AuditLog {
  id: string;
  family_group_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface RecordVersion {
  id: string;
  family_group_id: string;
  record_type: string;
  record_id: string;
  version_number: number;
  data: Record<string, any>;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
}

// ============================================================================
// IMPORT & RECONCILIATION
// ============================================================================

export interface ImportBatch {
  id: string;
  family_group_id: string;
  account_id: string;
  imported_by: string;
  import_source: 'csv' | 'bank_feed' | 'manual';
  total_rows: number;
  processed_rows: number;
  status: 'pending' | 'processing' | 'reviewed' | 'imported' | 'rejected';
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface ImportPendingTransaction {
  id: string;
  import_batch_id: string;
  family_group_id: string;
  row_index: number;
  raw_data: Record<string, any>;
  date: string;
  amount: number;
  description: string;
  category_id: string | null;
  account_id: string | null;
  tags: string[] | null;
  notes: string | null;
  status: 'pending' | 'matched' | 'duplicate_warning' | 'manual_edit' | 'confirmed';
  matched_transaction_id: string | null;
  duplicate_score: number | null;
  is_reviewed: boolean;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reconciliation {
  id: string;
  family_group_id: string;
  import_transaction_id: string;
  matched_transaction_id: string | null;
  match_confidence: number;
  match_method: 'auto' | 'manual_confirm' | 'auto_confirmed';
  match_score_details: Record<string, any> | null;
  confirmed_by: string | null;
  is_duplicate: boolean;
  created_at: string;
}

// ============================================================================
// AUTOMATIC RULES
// ============================================================================

export interface RuleCondition {
  field: string; // 'description', 'amount', 'date', 'type', 'account_id', 'tags', etc.
  operator: 'contains' | 'not_contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'regex';
  value: any;
}

export interface TransactionRule {
  id: string;
  family_group_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  condition_type: 'all_match' | 'any_match';
  conditions: RuleCondition[];
  category_id: string | null;
  tags: string[] | null;
  account_id: string | null;
  auto_apply: boolean;
  require_review: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RuleApplication {
  id: string;
  family_group_id: string;
  rule_id: string;
  transaction_id: string;
  applied_at: string;
}

// ============================================================================
// RECURRING TRANSACTIONS (ADVANCED)
// ============================================================================

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type NotificationMethod = 'push' | 'telegram' | 'email' | 'all';

export interface RecurringTemplate {
  id: string;
  family_group_id: string;
  name: string;
  description: string | null;
  
  frequency: RecurrenceFrequency;
  interval: number;
  day_of_month: number | null;
  day_of_week: DayOfWeek | null;
  months: string[] | null;
  
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  tags: string[] | null;
  
  starts_at: string;
  ends_at: string | null;
  max_occurrences: number | null;
  
  notify_days_before: number | null;
  notify_method: NotificationMethod | null;
  
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringOccurrence {
  id: string;
  template_id: string;
  family_group_id: string;
  occurrence_date: string;
  transaction_id: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'failed';
  skip_reason: string | null;
  created_at: string;
}

// ============================================================================
// CASHFLOW FORECAST
// ============================================================================

export interface CashflowForecast {
  id: string;
  family_group_id: string;
  account_id: string;
  forecast_date: string;
  forecast_days: 30 | 60 | 90;
  current_balance: number;
  forecast_balance: number;
  projected_income: number;
  projected_expenses: number;
  confidence_level: 'low' | 'medium' | 'high';
  calculation_method: 'recurring' | 'avg_historical' | 'combined';
  metadata: Record<string, any> | null;
  created_at: string;
}

// ============================================================================
// COLLABORATION & COMMENTS
// ============================================================================

export interface TransactionComment {
  id: string;
  transaction_id: string;
  family_group_id: string;
  user_id: string;
  content: string;
  is_system_comment: boolean;
  is_settlement_comment: boolean;
  settled_between_user_a: string | null;
  settled_between_user_b: string | null;
  settlement_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionApproval {
  id: string;
  transaction_id: string;
  family_group_id: string;
  requested_by: string;
  approval_threshold: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approval_reason: string | null;
  created_at: string;
  approved_at: string | null;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export type NotificationType = 'budget_alert' | 'recurring_reminder' | 'anomaly' | 'approval_needed' | 'settlement_reminder' | 'milestone';
export type NotificationStatus = 'created' | 'queued' | 'sent' | 'failed';
export type DeliveryChannel = 'push' | 'telegram' | 'email';

export interface Notification {
  id: string;
  family_group_id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  status: NotificationStatus;
  delivery_channels: DeliveryChannel[];
  sent_at: string | null;
  read_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export type AnomalyType = 'unusual_amount' | 'unusual_category' | 'duplicate_like' | 'fraud_score';
export type SeverityLevel = 'info' | 'warning' | 'critical';

export interface Anomaly {
  id: string;
  family_group_id: string;
  transaction_id: string | null;
  anomaly_type: AnomalyType;
  severity: SeverityLevel;
  description: string;
  confidence: number;
  analysis: Record<string, any> | null;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}
