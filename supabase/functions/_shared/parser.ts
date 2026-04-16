import { z } from 'npm:zod@4.3.6';

export const parseRequestSchema = z.object({
  text: z.string().min(1),
  categories: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      type: z.enum(['income', 'expense']),
    }),
  ).default([]),
});

const incomeKeywords = ['stipendio', 'entrata', 'income', 'bonus', 'rimborso', 'accredito'];
const expenseKeywords = ['spesa', 'expense', 'uscita', 'pagato', 'speso', 'acquisto', 'addebito'];

export function parseTransaction(text: string, categories: Array<{ name: string; type: 'income' | 'expense' }>) {
  const source = text.trim();
  if (!source) return null;

  let type: 'income' | 'expense' = 'expense';
  let working = source;

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

  const validCategories = categories.filter((c) => c.type === type);
  let categoryName: string | null = null;

  for (const category of validCategories) {
    const catName = category.name.toLowerCase();
    if (words.some((w) => catName.includes(w) || w.includes(catName))) {
      categoryName = category.name;
      break;
    }
  }

  return {
    amount,
    type,
    notes: working.replace(amountMatch[0], '').trim() || null,
    categoryName,
    confidence: categoryName ? 0.9 : 0.65,
  };
}
