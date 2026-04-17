// 16-Apr-2026 — Emanuele Motta
// Refund mode: create tracked refund linked to original expense

import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from '@/types/finance';

type UntypedSupabase = {
  from: (table: string) => {
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

interface CreateRefundInput {
  originalExpense: Transaction;
  userId: string;
  reason?: string;
}

export async function createTrackedRefund({ originalExpense, userId, reason }: CreateRefundInput): Promise<void> {
  if (originalExpense.type !== 'expense') {
    throw new Error('Il rimborso e disponibile solo per spese.');
  }

  const refundPayload = {
    family_group_id: originalExpense.family_group_id,
    user_id: userId,
    created_by_user_id: userId,
    paid_by_user_id: userId,
    category_id: originalExpense.category_id,
    account_id: originalExpense.account_id,
    to_account_id: null,
    amount: Number(originalExpense.amount),
    type: 'income' as const,
    date: new Date().toISOString().split('T')[0],
    notes: `Rimborso: ${reason?.trim() || originalExpense.notes || 'spesa precedente'}`,
    recurring: false,
    recurrence_type: null,
    tags: Array.from(new Set([...(originalExpense.tags || []), 'refund'])),
  };

  const { data: refundTx, error: refundError } = await supabase
    .from('transactions')
    .insert(refundPayload as never)
    .select('*')
    .single();

  if (refundError) throw refundError;

  const untypedSupabase = supabase as unknown as UntypedSupabase;
  const { error: linkError } = await untypedSupabase
    .from('transaction_refunds')
    .insert({
      family_group_id: originalExpense.family_group_id,
      original_transaction_id: originalExpense.id,
      refund_transaction_id: refundTx.id,
      reason: reason?.trim() || null,
      created_by: userId,
    } as never);

  if (linkError) throw linkError;
}
