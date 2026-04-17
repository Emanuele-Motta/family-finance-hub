// 16-Apr-2026 — Emanuele Motta
// Regole di automazione backend e servizio di applicazione

import { supabase } from '@/integrations/supabase/client';
import type { TransactionRule, TransactionAuditEntry } from '@/types/finance';
import { z } from 'zod';

const ruleSchema = z.object({
  familyGroupId: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(1000),
  conditionLogic: z.enum(['and', 'or']).default('and'),
  conditions: z.object({
    keywords: z.array(z.string()).optional(),
    minAmount: z.number().positive().optional(),
    maxAmount: z.number().positive().optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
    types: z.array(z.enum(['income', 'expense', 'transfer'])).optional(),
  }),
  actions: z.object({
    setCategoryId: z.string().uuid().optional(),
    addTags: z.array(z.string()).optional(),
    setType: z.enum(['income', 'expense']).optional(),
    skipIfMatched: z.boolean().optional(),
  }),
});

function normalizeTransactionRule(raw: Partial<TransactionRule>): TransactionRule {
  const safeConditions = (raw.conditions && typeof raw.conditions === 'object') ? raw.conditions : {};
  const safeActions = (raw.actions && typeof raw.actions === 'object') ? raw.actions : {};

  return {
    id: raw.id || '',
    family_group_id: raw.family_group_id || '',
    name: raw.name || 'Regola senza nome',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    priority: Number.isFinite(raw.priority) ? Number(raw.priority) : 0,
    conditionLogic: raw.conditionLogic === 'or' ? 'or' : 'and',
    conditions: {
      keywords: Array.isArray(safeConditions.keywords) ? safeConditions.keywords.filter((v): v is string => typeof v === 'string') : undefined,
      minAmount: typeof safeConditions.minAmount === 'number' ? safeConditions.minAmount : undefined,
      maxAmount: typeof safeConditions.maxAmount === 'number' ? safeConditions.maxAmount : undefined,
      categoryIds: Array.isArray(safeConditions.categoryIds) ? safeConditions.categoryIds.filter((v): v is string => typeof v === 'string') : undefined,
      types: Array.isArray(safeConditions.types) ? safeConditions.types.filter((v): v is 'income' | 'expense' | 'transfer' => v === 'income' || v === 'expense' || v === 'transfer') : undefined,
    },
    actions: {
      setCategoryId: typeof safeActions.setCategoryId === 'string' ? safeActions.setCategoryId : undefined,
      addTags: Array.isArray(safeActions.addTags) ? safeActions.addTags.filter((v): v is string => typeof v === 'string') : undefined,
      setType: safeActions.setType === 'income' || safeActions.setType === 'expense' ? safeActions.setType : undefined,
      skipIfMatched: typeof safeActions.skipIfMatched === 'boolean' ? safeActions.skipIfMatched : undefined,
    },
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
  };
}

export async function getTransactionRules(familyGroupId: string): Promise<TransactionRule[]> {
  const { data, error } = await supabase
    .from('transaction_rules')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => normalizeTransactionRule(row as Partial<TransactionRule>));
}

export async function createTransactionRule(
  familyGroupId: string,
  input: Omit<TransactionRule, 'id' | 'family_group_id' | 'created_at' | 'updated_at'>
): Promise<TransactionRule> {
  const validated = ruleSchema.parse({ familyGroupId, ...input });

  const { data, error } = await (supabase
    .from('transaction_rules') as any)
    .insert({
      family_group_id: validated.familyGroupId,
      name: validated.name,
      enabled: validated.enabled,
      priority: validated.priority,
      conditions: validated.conditions,
      actions: validated.actions,
    })
    .select()
    .single();

  if (error) throw error;
  return normalizeTransactionRule(data as Partial<TransactionRule>);
}

export async function updateTransactionRule(
  ruleId: string,
  updates: Partial<Omit<TransactionRule, 'id' | 'family_group_id' | 'created_at' | 'updated_at'>>
): Promise<TransactionRule> {
  const { data, error } = await (supabase
    .from('transaction_rules') as any)
    .update(updates)
    .eq('id', ruleId)
    .select()
    .single();

  if (error) throw error;
  return normalizeTransactionRule(data as Partial<TransactionRule>);
}

export async function deleteTransactionRule(ruleId: string): Promise<void> {
  const { error } = await supabase.from('transaction_rules').delete().eq('id', ruleId);
  if (error) throw error;
}

// Valuta una regola contro una transazione
export function evaluateRule(
  rule: TransactionRule,
  transaction: {
    type: 'income' | 'expense' | 'transfer';
    category_id: string | null;
    amount: number;
    notes: string | null;
  }
): boolean {
  const { conditions, conditionLogic = 'and' } = rule;

  // Valuta singole condizioni
  const results: boolean[] = [];

  if (conditions.types) {
    results.push(conditions.types.includes(transaction.type));
  }

  if (conditions.minAmount) {
    results.push(transaction.amount >= conditions.minAmount);
  }

  if (conditions.maxAmount) {
    results.push(transaction.amount <= conditions.maxAmount);
  }

  if (conditions.categoryIds && transaction.category_id) {
    results.push(conditions.categoryIds.includes(transaction.category_id));
  }

  if (conditions.keywords && transaction.notes) {
    const notesLower = transaction.notes.toLowerCase();
    const matched = conditions.keywords.some((kw) => notesLower.includes(kw.toLowerCase()));
    results.push(matched);
  }

  // Se nessuna condizione, considera it matched
  if (results.length === 0) return true;

  // Applica logica AND/OR
  if (conditionLogic === 'and') {
    return results.every((r) => r); // Tutte le condizioni devono essere vere
  } else {
    return results.some((r) => r); // Almeno una condizione deve essere vera
  }
}

// Applica le azioni di una regola
export function applyRuleActions(
  rule: TransactionRule,
  transaction: Record<string, unknown>
): Partial<Record<string, unknown>> {
  const { actions } = rule;
  const result: Partial<Record<string, unknown>> = {};

  if (actions.setCategoryId) result.category_id = actions.setCategoryId;
  if (actions.setType) result.type = actions.setType;
  if (actions.addTags) {
    const existingTags = (transaction.tags || []) as string[];
    result.tags = Array.from(new Set([...existingTags, ...actions.addTags]));
  }

  return result;
}

// Recupera audit di una transazione
export async function getTransactionAudit(transactionId: string): Promise<TransactionAuditEntry[]> {
  const { data, error } = await supabase
    .from('transaction_audit')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as TransactionAuditEntry[];
}

// Recupera audit famiglia intera
export async function getFamilyAudit(familyGroupId: string, limit = 100): Promise<TransactionAuditEntry[]> {
  const { data, error } = await supabase
    .from('transaction_audit')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as TransactionAuditEntry[];
}
