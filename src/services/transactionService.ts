import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { Category } from '@/types/finance';
import { parseTransaction } from '@/lib/transactionParser';

const createTransactionSchema = z.object({
  familyGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  date: z.string(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

const createTransferSchema = z.object({
  familyGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string(),
  notes: z.string().nullable().optional(),
});

export async function createTransaction(input: z.input<typeof createTransactionSchema>) {
  const payload = createTransactionSchema.parse(input);

  const { error } = await supabase.from('transactions').insert({
    family_group_id: payload.familyGroupId,
    user_id: payload.userId,
    created_by_user_id: payload.userId,
    paid_by_user_id: payload.userId,
    account_id: payload.accountId,
    to_account_id: null,
    amount: payload.amount,
    type: payload.type,
    category_id: payload.categoryId ?? null,
    date: payload.date,
    notes: payload.notes ?? null,
    recurring: false,
    recurrence_type: null,
    tags: payload.tags ?? null,
  } as never);

  if (error) throw error;
}

export async function createTransfer(input: z.input<typeof createTransferSchema>) {
  const payload = createTransferSchema.parse(input);

  if (payload.fromAccountId === payload.toAccountId) {
    throw new Error('Account origine e destinazione devono essere diversi');
  }

  const { error } = await supabase.from('transactions').insert({
    family_group_id: payload.familyGroupId,
    user_id: payload.userId,
    created_by_user_id: payload.userId,
    paid_by_user_id: payload.userId,
    account_id: payload.fromAccountId,
    to_account_id: payload.toAccountId,
    amount: payload.amount,
    type: 'transfer',
    category_id: null,
    date: payload.date,
    notes: payload.notes ?? null,
    recurring: false,
    recurrence_type: null,
    tags: null,
  } as never);

  if (error) throw error;
}

export async function parseAndCreate(input: {
  text: string;
  categories: Category[];
  familyGroupId: string;
  userId: string;
  accountId: string;
  date?: string;
}) {
  const parsed = parseTransaction(input.text, input.categories);
  if (!parsed) throw new Error('Impossibile interpretare il testo');

  await createTransaction({
    familyGroupId: input.familyGroupId,
    userId: input.userId,
    accountId: input.accountId,
    amount: parsed.amount,
    type: parsed.type,
    date: input.date || new Date().toISOString().split('T')[0],
    categoryId: parsed.categoryId,
    notes: parsed.notes,
  });

  return parsed;
}
