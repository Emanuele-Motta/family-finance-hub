// Author: Emanuele Motta
// Date: 16-Apr-2026
// Transaction rules service: Gmail-style automatic categorization and tagging
// Supports complex conditions with AND/OR logic and regex patterns

import type { 
  TransactionRule,
  RuleCondition,
  Transaction,
  ImportPendingTransaction
} from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';

/**
 * Evaluates a condition against a transaction
 */
export function evaluateCondition(
  condition: RuleCondition,
  transaction: Transaction | ImportPendingTransaction
): boolean {
  const value = getTransactionField(transaction, condition.field);

  if (!evaluateOperator(condition.operator, value, condition.value)) {
    return false;
  }

  return true;
}

/**
 * Gets a field value from transaction for condition evaluation
 */
function getTransactionField(
  transaction: Transaction | ImportPendingTransaction,
  field: string
): any {
  switch (field) {
    case 'description':
      return 'description' in transaction
        ? transaction.description
        : transaction.description;
    case 'amount':
      return transaction.amount;
    case 'type':
      return 'type' in transaction ? transaction.type : 'expense';
    case 'account_id':
      return transaction.account_id;
    case 'category_id':
      return 'category_id' in transaction ? transaction.category_id : null;
    case 'date':
      return transaction.date;
    case 'tags':
      return 'tags' in transaction ? transaction.tags || [] : [];
    case 'notes':
      return 'notes' in transaction ? transaction.notes : null;
    default:
      return null;
  }
}

/**
 * Evaluates an operator against a value and condition value
 */
function evaluateOperator(
  operator: RuleCondition['operator'],
  value: any,
  conditionValue: any
): boolean {
  if (value === null || value === undefined) return false;

  const strValue = String(value).toLowerCase();
  const strCondition = String(conditionValue).toLowerCase();

  switch (operator) {
    case 'contains':
      return strValue.includes(strCondition);

    case 'not_contains':
      return !strValue.includes(strCondition);

    case 'equals':
      return value === conditionValue || strValue === strCondition;

    case 'gt':
      return Number(value) > Number(conditionValue);

    case 'lt':
      return Number(value) < Number(conditionValue);

    case 'gte':
      return Number(value) >= Number(conditionValue);

    case 'lte':
      return Number(value) <= Number(conditionValue);

    case 'in':
      const values = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return values.some(v => strValue === String(v).toLowerCase());

    case 'not_in':
      const values2 = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return !values2.some(v => strValue === String(v).toLowerCase());

    case 'regex':
      try {
        const regex = new RegExp(conditionValue, 'i');
        return regex.test(strValue);
      } catch {
        return false;
      }

    default:
      return false;
  }
}

/**
 * Evaluates all conditions in a rule (AND or OR logic)
 */
export function evaluateRule(
  rule: TransactionRule,
  transaction: Transaction | ImportPendingTransaction
): boolean {
  if (!rule.is_active) return false;

  const results = rule.conditions.map(c => evaluateCondition(c, transaction));

  if (rule.condition_type === 'all_match') {
    return results.every(r => r);
  } else {
    // 'any_match'
    return results.some(r => r);
  }
}

/**
 * Finds and applies matching rules to a transaction
 * Returns applied rule IDs
 */
export async function applyRulesToTransaction(
  transaction: Transaction | ImportPendingTransaction,
  familyGroupId: string,
  dryRun = false
): Promise<{
  appliedRules: string[];
  updates: Partial<Transaction | ImportPendingTransaction>;
}> {
  // Get active rules sorted by priority
  const { data: rules, error } = await supabase
    .from('transaction_rules')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) throw error;

  const rules_typed = rules as TransactionRule[];
  const appliedRules: string[] = [];
  const updates: any = {};

  for (const rule of rules_typed) {
    if (!evaluateRule(rule, transaction)) continue;

    appliedRules.push(rule.id);

    // Apply rule actions
    if (rule.category_id) {
      updates.category_id = rule.category_id;
    }

    if (rule.tags && rule.tags.length > 0) {
      const existingTags = (transaction.tags || []) as string[];
      updates.tags = Array.from(new Set([...existingTags, ...rule.tags]));
    }

    if (rule.account_id) {
      updates.account_id = rule.account_id;
    }

    // Stop processing if first matching rule (priority-based)
    if (rule.priority === (rules_typed[0]?.priority || 0)) {
      break;
    }
  }

  // Apply updates if not dry run
  if (!dryRun && appliedRules.length > 0 && 'id' in transaction) {
    const isImport = 'import_batch_id' in transaction;
    const table = isImport ? 'import_pending_transactions' : 'transactions';
    
    await supabase
      .from(table)
      .update({ ...updates, status: 'manual_edit' })
      .eq('id', (transaction as any).id);

    // Log rule applications
    const applicationsData = appliedRules.map(ruleId => ({
      family_group_id: familyGroupId,
      rule_id: ruleId,
      transaction_id: 'id' in transaction ? (transaction as any).id : null,
    }));

    if (applicationsData[0]?.transaction_id) {
      await supabase.from('rule_applications').insert(applicationsData);
    }
  }

  return { appliedRules, updates };
}

/**
 * Creates a new rule
 */
export async function createRule(
  rule: Omit<TransactionRule, 'id' | 'created_at' | 'updated_at'>
): Promise<TransactionRule> {
  const { data, error } = await supabase
    .from('transaction_rules')
    .insert({
      ...rule,
      conditions: rule.conditions, // Store as JSONB
    })
    .select()
    .single();

  if (error) throw error;
  return data as TransactionRule;
}

/**
 * Updates an existing rule
 */
export async function updateRule(
  ruleId: string,
  updates: Partial<TransactionRule>
): Promise<TransactionRule> {
  const { data, error } = await supabase
    .from('transaction_rules')
    .update({
      ...updates,
      conditions: updates.conditions || undefined,
    })
    .eq('id', ruleId)
    .select()
    .single();

  if (error) throw error;
  return data as TransactionRule;
}

/**
 * Deletes a rule
 */
export async function deleteRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('transaction_rules')
    .delete()
    .eq('id', ruleId);

  if (error) throw error;
}

/**
 * Gets all rules for a family group
 */
export async function getRules(familyGroupId: string): Promise<TransactionRule[]> {
  const { data, error } = await supabase
    .from('transaction_rules')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .order('priority', { ascending: true });

  if (error) throw error;
  return (data as TransactionRule[]) || [];
}

/**
 * Tests a rule against sample transactions
 */
export async function testRule(
  rule: TransactionRule,
  familyGroupId: string
): Promise<{
  matchedCount: number;
  sampleMatches: (Transaction | ImportPendingTransaction)[];
}> {
  // Get recent transactions as samples
  const { data: recentTransactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .order('date', { ascending: false })
    .limit(50);

  if (txError) throw txError;

  const transactions_typed = recentTransactions as Transaction[];
  const matches = transactions_typed.filter(tx => evaluateRule(rule, tx));

  return {
    matchedCount: matches.length,
    sampleMatches: matches.slice(0, 5),
  };
}

/**
 * Gets rule application history
 */
export async function getRuleApplications(
  ruleId: string,
  limit = 100
): Promise<any[]> {
  const { data, error } = await supabase
    .from('rule_applications')
    .select('*')
    .eq('rule_id', ruleId)
    .order('applied_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Helper: creates a condition
 */
export function createCondition(
  field: string,
  operator: RuleCondition['operator'],
  value: any
): RuleCondition {
  return { field, operator, value };
}

/**
 * Helper: creates a template rule for common use cases
 */
export function createTemplateRule(
  type: 'merchant' | 'category' | 'amount_threshold' | 'recurring',
  params: any
): Omit<TransactionRule, 'id' | 'created_at' | 'updated_at'> {
  switch (type) {
    case 'merchant':
      return {
        family_group_id: params.familyGroupId,
        name: `Auto-${params.merchantName}`,
        is_active: true,
        priority: 100,
        condition_type: 'any_match',
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: params.merchantName,
          },
        ],
        category_id: params.categoryId,
        auto_apply: true,
        require_review: false,
        created_by: params.userId,
      } as any;

    case 'category':
      return {
        family_group_id: params.familyGroupId,
        name: `${params.categoryName} auto-tagging`,
        is_active: true,
        priority: 100,
        condition_type: 'all_match',
        conditions: [
          {
            field: 'description',
            operator: 'regex',
            value: params.keywords.join('|'),
          },
        ],
        tags: [params.categoryName],
        auto_apply: true,
        require_review: false,
        created_by: params.userId,
      } as any;

    case 'amount_threshold':
      return {
        family_group_id: params.familyGroupId,
        name: `High value transaction alert (> €${params.threshold})`,
        is_active: true,
        priority: 50,
        condition_type: 'all_match',
        conditions: [
          {
            field: 'amount',
            operator: 'gte',
            value: params.threshold,
          },
        ],
        require_review: true,
        auto_apply: false,
        created_by: params.userId,
      } as any;

    default:
      throw new Error(`Unknown template type: ${type}`);
  }
}
