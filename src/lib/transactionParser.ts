import { z } from 'zod';
import type { Category } from '@/types/finance';

export const parsedTransactionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  notes: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ParsedTransaction = z.infer<typeof parsedTransactionSchema>;

const incomeKeywords = ['stipendio', 'entrata', 'income', 'bonus', 'rimborso', 'accredito'];
const expenseKeywords = ['spesa', 'expense', 'uscita', 'pagato', 'speso', 'acquisto', 'addebito'];

export function parseTransaction(text: string, categories: Category[]): ParsedTransaction | null {
  const raw = text.trim();
  if (!raw) return null;

  let working = raw;
  let type: 'income' | 'expense' = 'expense';

  if (working.startsWith('+')) {
    type = 'income';
    working = working.slice(1).trim();
  } else if (working.startsWith('-')) {
    type = 'expense';
    working = working.slice(1).trim();
  }

  const amountMatch = working.match(/(\d+(?:[.,]\d+)?)/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const lower = working.toLowerCase();
  const words = lower.split(/\s+/);

  if (incomeKeywords.some((k) => lower.includes(k))) type = 'income';
  if (expenseKeywords.some((k) => lower.includes(k))) type = 'expense';

  const filteredCategories = categories.filter((c) => c.type === type);
  let category: Category | null = null;

  for (const c of filteredCategories) {
    const n = c.name.toLowerCase();
    if (words.some((w) => n.includes(w) || w.includes(n))) {
      category = c;
      break;
    }
  }

  const notes = working.replace(amountMatch[0], '').trim() || null;
  const confidence = category ? 0.9 : 0.65;

  return parsedTransactionSchema.parse({
    amount,
    type,
    notes,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    confidence,
  });
}
