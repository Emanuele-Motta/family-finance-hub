// Author: Emanuele Motta
// Date: 16-Apr-2026

import { useMemo, useState } from 'react';
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, Legend } from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, getDaysInMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChartNoAxesCombined, TrendingDown, TrendingUp, Calendar } from 'lucide-react';

const CHART_COLORS = [
  'hsl(205 89% 48%)',
  'hsl(160 84% 39%)',
  'hsl(38 92% 50%)',
  'hsl(347 77% 50%)',
  'hsl(271 91% 65%)',
  'hsl(190 80% 45%)',
];

export default function AnalyticsPage() {
  const { transactions } = useTransactions();
  const categories = useCategories();
  const { accounts } = useAccounts();
  const [periodMonths, setPeriodMonths] = useState<'3' | '6' | '12'>('6');

  const fmtCurrency = (value: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

  const periodData = useMemo(() => {
    const months = Number(periodMonths);
    const start = startOfMonth(subMonths(new Date(), months - 1));
    const end = endOfMonth(new Date());

    const tx = transactions.filter((transaction) => {
      const date = parseISO(transaction.date);
      return date >= start && date <= end;
    });

    const monthlyMap = new Map<string, { month: string; income: number; expense: number; balance: number }>();
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const key = format(monthDate, 'yyyy-MM');
      monthlyMap.set(key, {
        month: format(monthDate, 'MMM yy', { locale: it }),
        income: 0,
        expense: 0,
        balance: 0,
      });
    }

    tx.forEach((transaction) => {
      const key = transaction.date.slice(0, 7);
      const row = monthlyMap.get(key);
      if (!row) return;
      if (transaction.type === 'income') row.income += Number(transaction.amount);
      if (transaction.type === 'expense') row.expense += Number(transaction.amount);
    });

    monthlyMap.forEach((value) => {
      value.balance = value.income - value.expense;
    });

    return {
      tx,
      monthly: Array.from(monthlyMap.values()),
    };
  }, [transactions, periodMonths]);

  const expensesByCategory = useMemo(() => {
    const byCategory = new Map<string, number>();
    periodData.tx
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        const categoryName = categories.find((category) => category.id === transaction.category_id)?.name || 'Altro';
        byCategory.set(categoryName, (byCategory.get(categoryName) || 0) + Number(transaction.amount));
      });

    return Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [periodData.tx, categories]);

  const accountFlow = useMemo(() => {
    const byAccount = new Map<string, { name: string; income: number; expense: number }>();

    accounts.forEach((account) => {
      byAccount.set(account.id, { name: account.name, income: 0, expense: 0 });
    });

    periodData.tx.forEach((transaction) => {
      const row = byAccount.get(transaction.account_id);
      if (!row) return;
      if (transaction.type === 'income') row.income += Number(transaction.amount);
      if (transaction.type === 'expense') row.expense += Number(transaction.amount);
    });

    return Array.from(byAccount.values())
      .map((row) => ({ ...row, net: row.income - row.expense }))
      .filter((row) => row.income > 0 || row.expense > 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [periodData.tx, accounts]);

  const totals = useMemo(() => {
    const income = periodData.tx.filter((t) => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = periodData.tx.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
    return { income, expense, net: income - expense };
  }, [periodData.tx]);

  const periodLabel = useMemo(() => {
    const months = Number(periodMonths);
    const start = startOfMonth(subMonths(new Date(), months - 1));
    const end = endOfMonth(new Date());
    return `${format(start, 'dd MMM yyyy', { locale: it })} - ${format(end, 'dd MMM yyyy', { locale: it })}`;
  }, [periodMonths]);

  const avgExpensePerMonth = useMemo(() => {
    if (periodData.monthly.length === 0) return 0;
    return totals.expense / periodData.monthly.length;
  }, [periodData.monthly.length, totals.expense]);

  const topCategory = expensesByCategory[0] || null;

  const monthComparisonDaily = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthDate = subMonths(now, 1);
    const previousMonthStart = startOfMonth(previousMonthDate);
    const previousMonthEnd = endOfMonth(previousMonthDate);

    const currentMonthTransactions = transactions.filter((transaction) => {
      const date = parseISO(transaction.date);
      return date >= currentMonthStart && date <= currentMonthEnd;
    });

    const previousMonthTransactions = transactions.filter((transaction) => {
      const date = parseISO(transaction.date);
      return date >= previousMonthStart && date <= previousMonthEnd;
    });

    const currentMonthDays = getDaysInMonth(currentMonthStart);
    const previousMonthDays = getDaysInMonth(previousMonthStart);
    const maxDays = Math.max(currentMonthDays, previousMonthDays);

    const currentExpenseByDay = new Map<number, number>();
    const previousExpenseByDay = new Map<number, number>();

    currentMonthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        const day = Number(transaction.date.slice(8, 10));
        currentExpenseByDay.set(day, (currentExpenseByDay.get(day) || 0) + Number(transaction.amount));
      });

    previousMonthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        const day = Number(transaction.date.slice(8, 10));
        previousExpenseByDay.set(day, (previousExpenseByDay.get(day) || 0) + Number(transaction.amount));
      });

    return Array.from({ length: maxDays }, (_, index) => {
      const day = index + 1;
      return {
        day,
        currentExpense: currentExpenseByDay.get(day) || 0,
        previousExpense: previousExpenseByDay.get(day) || 0,
      };
    });
  }, [transactions]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ChartNoAxesCombined className="w-5 h-5 text-primary" />
            Analytics
          </h2>
          <p className="text-sm text-muted-foreground">Vista avanzata dei grafici con confronto multi-periodo.</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {periodLabel}
            </span>
            <Badge variant="outline">{periodData.tx.length} movimenti analizzati</Badge>
          </div>
        </div>
        <Select value={periodMonths} onValueChange={(value: '3' | '6' | '12') => setPeriodMonths(value)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Ultimi 3 mesi</SelectItem>
            <SelectItem value="6">Ultimi 6 mesi</SelectItem>
            <SelectItem value="12">Ultimi 12 mesi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Entrate periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">{fmtCurrency(totals.income)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Spese periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-500">{fmtCurrency(totals.expense)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Saldo netto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${totals.net >= 0 ? 'text-primary' : 'text-orange-500'}`}>{fmtCurrency(totals.net)}</p>
            <Badge variant="outline" className="mt-2 gap-1">
              {totals.net >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {totals.net >= 0 ? 'Trend positivo' : 'Trend da migliorare'}
            </Badge>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Media spese / mese</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-sky-600">{fmtCurrency(avgExpensePerMonth)}</p>
            <p className="text-xs text-muted-foreground mt-2 truncate">
              Top categoria: {topCategory ? `${topCategory.name} (${fmtCurrency(topCategory.value)})` : 'Nessuna'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Spese giornaliere: mese corrente vs precedente</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthComparisonDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value: number) => fmtCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="previousExpense" name="Mese precedente" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeDasharray="5 4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="currentExpense" name="Mese corrente" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Entrate vs Spese (mensile)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => fmtCurrency(value)} />
                <Legend />
                <Bar dataKey="income" name="Entrate" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Spese" fill="hsl(0 84% 60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Andamento saldo cumulato</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={periodData.monthly}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => fmtCurrency(value)} />
                <Area type="monotone" dataKey="balance" name="Saldo" stroke="hsl(var(--primary))" fill="url(#balanceGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Spese per categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expensesByCategory.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">Nessuna spesa nel periodo selezionato.</div>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expensesByCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                        {expensesByCategory.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => fmtCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {expensesByCategory.slice(0, 4).map((category, index) => {
                    const ratio = totals.expense > 0 ? (category.value / totals.expense) * 100 : 0;
                    return (
                      <div key={category.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate">{category.name}</span>
                          <span className="text-muted-foreground">{ratio.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, ratio)}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Performance per account</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {accountFlow.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Nessun movimento per account nel periodo selezionato.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={accountFlow} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => fmtCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Entrate" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expense" name="Spese" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="net" name="Netto" stroke="hsl(var(--primary))" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
