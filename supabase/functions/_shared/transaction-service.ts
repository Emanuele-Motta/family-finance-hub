import { createClient } from 'npm:@supabase/supabase-js@2.103.2';
import { z } from 'npm:zod@4.3.6';
import { parseTransaction } from './parser.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRole);

const createTransactionSchema = z.object({
  familyGroupId: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  date: z.string(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
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
  const { error } = await admin.from('transactions').insert({
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
    tags: null,
  });
  if (error) throw error;
}

export async function createTransfer(input: z.input<typeof createTransferSchema>) {
  const payload = createTransferSchema.parse(input);
  if (payload.fromAccountId === payload.toAccountId) {
    throw new Error('fromAccountId and toAccountId must be different');
  }
  const { error } = await admin.from('transactions').insert({
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
  });
  if (error) throw error;
}

export async function parseAndCreate(input: {
  text: string;
  categories: Array<{ name: string; type: 'income' | 'expense'; id?: string }>;
  familyGroupId: string;
  userId: string;
  accountId: string;
  date?: string;
}) {
  const parsed = parseTransaction(input.text, input.categories);
  if (!parsed) throw new Error('Unable to parse transaction text');

  const category = input.categories.find(
    (c) => c.type === parsed.type && c.name.toLowerCase() === (parsed.categoryName || '').toLowerCase(),
  );

  await createTransaction({
    familyGroupId: input.familyGroupId,
    userId: input.userId,
    accountId: input.accountId,
    amount: parsed.amount,
    type: parsed.type,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    categoryId: category?.id ?? null,
    notes: parsed.notes,
  });

  return parsed;
}
