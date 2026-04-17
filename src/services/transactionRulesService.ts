// Author: Emanuele Motta
// Date: 16-Apr-2026
// Transaction rules service: legacy condition-based evaluation helpers.
// NOTE: persistence APIs (create/update/delete) live in `rulesService.ts`.
// This file keeps pure helpers used by tests and any UI that builds conditions.

import type { RuleCondition, Transaction, ImportPendingTransaction } from '@/types/finance';

function getTransactionField(
  transaction: Transaction | ImportPendingTransaction,
  field: string
): unknown {
  switch (field) {
    case 'description':
      return 'description' in transaction ? (transaction as ImportPendingTransaction).description : null;
    case 'amount':
      return transaction.amount;
    case 'type':
      return 'type' in transaction ? (transaction as Transaction).type : 'expense';
    case 'account_id':
      return transaction.account_id;
    case 'category_id':
      return 'category_id' in transaction ? transaction.category_id : null;
    case 'date':
      return transaction.date;
    case 'tags':
      return 'tags' in transaction ? transaction.tags || [] : [];
    case 'notes':
      return 'notes' in transaction ? (transaction as Transaction).notes : null;
    default:
      return null;
  }
}

function evaluateOperator(
  operator: RuleCondition['operator'],
  value: unknown,
  conditionValue: unknown
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
    case 'in': {
      const values = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return values.some((v) => strValue === String(v).toLowerCase());
    }
    case 'not_in': {
      const values = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return !values.some((v) => strValue === String(v).toLowerCase());
    }
    case 'regex':
      try {
        return new RegExp(String(conditionValue), 'i').test(strValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function evaluateCondition(
  condition: RuleCondition,
  transaction: Transaction | ImportPendingTransaction
): boolean {
  const value = getTransactionField(transaction, condition.field);
  return evaluateOperator(condition.operator, value, condition.value);
}

export function evaluateRule(
  rule: { conditions: RuleCondition[]; condition_type?: 'all_match' | 'any_match'; is_active?: boolean },
  transaction: Transaction | ImportPendingTransaction
): boolean {
  if (rule.is_active === false) return false;
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  const results = conditions.map((c) => evaluateCondition(c, transaction));
  if (rule.condition_type === 'any_match') return results.some((r) => r);
  return results.every((r) => r);
}

export function createCondition(
  field: string,
  operator: RuleCondition['operator'],
  value: unknown
): RuleCondition {
  return { field, operator, value };
}
