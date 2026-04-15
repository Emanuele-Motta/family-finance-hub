import { useMemo } from 'react';
import { useTransactions, useCategories, useBudgets, useGoals, useDebts } from '@/hooks/useFinanceData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Wallet, CreditCard, Target } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)', 'hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)',
  'hsl(280, 68%, 60%)', 'hsl(340, 75%, 55%)', 'hsl(190, 80%, 45%)',
];

export default function DashboardPage() {
  const { transactions } = useTransactions();
  const categories = useCategories();
  const { budgets } = useBudgets();
  const { goals } = useGoals();
  const { debts } = useDebts();

  const now = new Date();
  const currentMonth = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const prevMonth = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const currentMonthTx = useMemo(() =>
    transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= currentMonth && d <= currentMonthEnd;
    }), [transactions, currentMonth, currentMonthEnd]);

  const prevMonthTx = useMemo(() =>
    transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= prevMonth && d <= prevMonthEnd;
    }), [transactions, prevMonth, prevMonthEnd]);

  const totalIncome = currentMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = currentMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const prevIncome = prevMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const prevExpense = prevMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netBalance = totalIncome - totalExpense;
  const totalDebt = debts.filter(d => !d.is_paid).reduce((s, d) => s + Number(d.remaining_amount), 0);
  const totalSavings = goals.reduce((s, g) => s + Number(g.current_amount), 0);

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  // Pie chart: expenses by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthTx.filter(t => t.type === 'expense').forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const name = cat?.name || 'Altro';
      map[name] = (map[name] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [currentMonthTx, categories]);

  // Line chart: daily balance trend for current month
  const balanceTrend = useMemo(() => {
    const days: Record<string, number> = {};
    let running = 0;
    const sorted = [...currentMonthTx].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach(t => {
      const day = format(parseISO(t.date), 'dd');
      running += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
      days[day] = running;
    });
    return Object.entries(days).map(([day, saldo]) => ({ day, saldo }));
  }, [currentMonthTx]);

  // Bar chart: last 6 months income vs expense
  const monthlyComparison = useMemo(() => {
    const months: { month: string; entrate: number; spese: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const txs = transactions.filter(t => {
        const d = parseISO(t.date);
        return d >= start && d <= end;
      });
      months.push({
        month: format(m, 'MMM', { locale: it }),
        entrate: txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        spese: txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return months;
  }, [transactions, now]);

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetUsed = totalBudget > 0 ? Math.min(100, Math.round((totalExpense / totalBudget) * 100)) : 0;

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const kpis = [
    { label: 'Entrate', value: fmt(totalIncome), change: pctChange(totalIncome, prevIncome), icon: TrendingUp, positive: true },
    { label: 'Spese', value: fmt(totalExpense), change: pctChange(totalExpense, prevExpense), icon: TrendingDown, positive: false },
    { label: 'Saldo netto', value: fmt(netBalance), icon: Wallet, change: null, positive: netBalance >= 0 },
    { label: 'Debiti', value: fmt(totalDebt), icon: CreditCard, change: null, positive: false },
    { label: 'Risparmi', value: fmt(totalSavings), icon: Target, change: null, positive: true },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.positive ? 'text-income' : 'text-expense'}`} />
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
              {kpi.change !== null && (
                <p className={`text-xs mt-1 ${kpi.change >= 0 ? 'text-income' : 'text-expense'}`}>
                  {kpi.change >= 0 ? '+' : ''}{kpi.change}% vs mese prec.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget progress */}
      {totalBudget > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Budget mensile</span>
              <span className="text-sm text-muted-foreground">{budgetUsed}%</span>
            </div>
            <Progress value={budgetUsed} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {fmt(totalExpense)} di {fmt(totalBudget)} utilizzato
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Pie */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Spese per categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nessuna spesa questo mese</p>
            )}
          </CardContent>
        </Card>

        {/* Line */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Andamento saldo</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={balanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="saldo" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nessun dato</p>
            )}
          </CardContent>
        </Card>

        {/* Bar */}
        <Card className="glass-card md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confronto mensile</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="entrate" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spese" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ultime transazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessuna transazione ancora. Inizia ad aggiungerne una!</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((t) => {
                const cat = categories.find(c => c.id === t.category_id);
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{cat?.name || 'Senza categoria'}</p>
                      <p className="text-xs text-muted-foreground">{t.notes || format(parseISO(t.date), 'dd MMM yyyy', { locale: it })}</p>
                    </div>
                    <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
