// 16-Apr-2026 — Emanuele Motta
// Insights automatici in linguaggio naturale

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Category, Transaction } from '@/types/finance';

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default function NaturalLanguageInsights({ transactions, categories }: Props) {
  const insights = useMemo(() => {
    if (transactions.length === 0) return ['Non ci sono ancora dati: appena aggiungi movimenti, ti mostro insight automatici.'];

    const expenses = transactions.filter((t) => t.type === 'expense');
    const income = transactions.filter((t) => t.type === 'income');

    const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
    const net = totalIncome - totalExpense;

    const categoryTotals = new Map<string, number>();
    for (const tx of expenses) {
      const category = categories.find((c) => c.id === tx.category_id)?.name || 'Altro';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + Number(tx.amount));
    }

    const [topCategory, topAmount] = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0] || ['Altro', 0];

    const refundCount = transactions.filter((t) => (t.tags || []).includes('refund')).length;

    const output: string[] = [];
    output.push(`Hai registrato ${expenses.length} spese e ${income.length} entrate.`);
    output.push(
      net >= 0
        ? `Stai mantenendo un saldo positivo di ${fmt(net)}.`
        : `Attenzione: il saldo corrente e negativo di ${fmt(Math.abs(net))}.`
    );
    if (topAmount > 0) {
      output.push(`La categoria che pesa di piu e ${topCategory} con ${fmt(topAmount)}.`);
    }
    if (refundCount > 0) {
      output.push(`Hai gia tracciato ${refundCount} rimborsi: ottimo per audit e riconciliazione.`);
    }

    return output;
  }, [transactions, categories]);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Insight automatici</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((line) => (
          <p key={line} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
        ))}
      </CardContent>
    </Card>
  );
}
