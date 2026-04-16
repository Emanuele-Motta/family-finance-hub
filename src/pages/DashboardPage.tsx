import { useMemo, useState } from 'react';
import { useTransactions, useCategories, useBudgets, useGoals, useDebts, useAccounts } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import SmartInsights from '@/components/SmartInsights';
import FinancialCalendar from '@/components/FinancialCalendar';
import { TrendingUp, TrendingDown, Wallet, CreditCard, Target, PiggyBank, Plus, BarChart3, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, getDaysInMonth, getDate } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)', 'hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)',
  'hsl(280, 68%, 60%)', 'hsl(340, 75%, 55%)', 'hsl(190, 80%, 45%)',
];

type QuickAction = 'income' | 'expense' | 'goal' | 'debt' | null;

export default function DashboardPage() {
  const { transactions, loading: txLoading, addTransaction } = useTransactions();
  const categories = useCategories();
  const { budgets, loading: budLoading } = useBudgets();
  const { goals, loading: goalLoading, updateGoal } = useGoals();
  const { debts, loading: debtLoading, addDebt } = useDebts();
  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();

  const [quickAction, setQuickAction] = useState<QuickAction>(null);
  const [quickForm, setQuickForm] = useState({ amount: '', category_id: '', notes: '', name: '' });

  const now = new Date();
  const currentMonth = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const prevMonth = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const currentMonthTx = useMemo(() =>
    transactions.filter(t => { const d = parseISO(t.date); return d >= currentMonth && d <= currentMonthEnd; }),
    [transactions, currentMonth, currentMonthEnd]);

  const prevMonthTx = useMemo(() =>
    transactions.filter(t => { const d = parseISO(t.date); return d >= prevMonth && d <= prevMonthEnd; }),
    [transactions, prevMonth, prevMonthEnd]);

  const totalIncome = currentMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = currentMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const prevIncome = prevMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const prevExpense = prevMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netBalance = totalIncome - totalExpense;
  const totalDebt = debts.filter(d => !d.is_paid).reduce((s, d) => s + Number(d.remaining_amount), 0);
  const totalSavings = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const accountBalances = useMemo(() => {
    const byAccount = new Map<string, number>();
    accounts.forEach((a) => byAccount.set(a.id, Number(a.balance || 0)));
    transactions.forEach((t) => {
      const amount = Number(t.amount);
      if (t.type === 'income') byAccount.set(t.account_id, (byAccount.get(t.account_id) || 0) + amount);
      if (t.type === 'expense') byAccount.set(t.account_id, (byAccount.get(t.account_id) || 0) - amount);
      if (t.type === 'transfer') {
        byAccount.set(t.account_id, (byAccount.get(t.account_id) || 0) - amount);
        if (t.to_account_id) byAccount.set(t.to_account_id, (byAccount.get(t.to_account_id) || 0) + amount);
      }
    });
    return accounts.map((a) => ({ name: a.name, balance: byAccount.get(a.id) || 0 }));
  }, [accounts, transactions]);

  // Advanced KPIs
  const dayOfMonth = getDate(now);
  const daysInMonth = getDaysInMonth(now);
  const dailyAvgExpense = dayOfMonth > 0 ? totalExpense / dayOfMonth : 0;
  const monthlySavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0;
  const projectedBalance = totalIncome - (dailyAvgExpense * daysInMonth);

  // All-time balance (sum of all transactions)
  const allTimeBalance = useMemo(() =>
    transactions.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0),
    [transactions]);

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthTx.filter(t => t.type === 'expense').forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      map[cat?.name || 'Altro'] = (map[cat?.name || 'Altro'] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [currentMonthTx, categories]);

  const balanceTrend = useMemo(() => {
    const days: Record<string, number> = {};
    let running = 0;
    [...currentMonthTx].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      const day = format(parseISO(t.date), 'dd');
      running += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
      days[day] = running;
    });
    return Object.entries(days).map(([day, saldo]) => ({ day, saldo }));
  }, [currentMonthTx]);

  const monthlyComparison = useMemo(() => {
    const months: { month: string; entrate: number; spese: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const s = startOfMonth(m), e = endOfMonth(m);
      const txs = transactions.filter(t => { const d = parseISO(t.date); return d >= s && d <= e; });
      months.push({
        month: format(m, 'MMM', { locale: it }),
        entrate: txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        spese: txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return months;
  }, [transactions]);

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetUsed = totalBudget > 0 ? Math.min(100, Math.round((totalExpense / totalBudget) * 100)) : 0;
  const topSpender = useMemo(() => {
    const spent = new Map<string, number>();
    currentMonthTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => spent.set(t.created_by_user_id, (spent.get(t.created_by_user_id) || 0) + Number(t.amount)));
    const [userId, amount] = [...spent.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    return userId ? { userId, amount: amount || 0 } : null;
  }, [currentMonthTx]);

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const handleQuickSubmit = async () => {
    const defaultAccountId = accounts.find(a => a.is_primary)?.id || accounts[0]?.id;
    if (!user || !currentFamilyGroupId || !quickForm.amount || !defaultAccountId) return;
    const amount = parseFloat(quickForm.amount);
    if (isNaN(amount)) return;

    try {
      if (quickAction === 'income' || quickAction === 'expense') {
        await addTransaction({
          family_group_id: currentFamilyGroupId,
          user_id: user.id,
          created_by_user_id: user.id,
          paid_by_user_id: user.id,
          category_id: quickForm.category_id || null,
          account_id: defaultAccountId,
          to_account_id: null,
          amount,
          type: quickAction,
          date: new Date().toISOString().split('T')[0],
          notes: quickForm.notes || null,
          recurring: false,
          recurrence_type: null,
          tags: null,
        });
        toast.success(`${quickAction === 'income' ? 'Entrata' : 'Spesa'} aggiunta!`);
      } else if (quickAction === 'goal' && goals.length > 0) {
        await updateGoal(goals[0].id, { current_amount: Number(goals[0].current_amount) + amount });
        toast.success('Risparmio aggiunto!');
      } else if (quickAction === 'debt') {
        await addDebt({
          family_group_id: currentFamilyGroupId,
          name: quickForm.name || 'Nuovo debito',
          total_amount: amount,
          remaining_amount: amount,
          due_date: null,
          interest_rate: null,
          monthly_payment: null,
          notes: null,
          is_paid: false,
        });
        toast.success('Debito aggiunto!');
      }
      setQuickAction(null);
      setQuickForm({ amount: '', category_id: '', notes: '', name: '' });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loading = txLoading || budLoading || goalLoading || debtLoading;

  const kpis = [
    { label: 'Saldo attuale', value: fmt(allTimeBalance), icon: Wallet, positive: allTimeBalance >= 0, action: null as QuickAction },
    { label: 'Entrate', value: fmt(totalIncome), change: pctChange(totalIncome, prevIncome), icon: TrendingUp, positive: true, action: 'income' as QuickAction, cta: 'Aggiungi entrata' },
    { label: 'Spese', value: fmt(totalExpense), change: pctChange(totalExpense, prevExpense), icon: TrendingDown, positive: false, action: 'expense' as QuickAction, cta: 'Aggiungi spesa' },
    { label: 'Risparmio', value: `${savingsRate.toFixed(0)}%`, sub: fmt(monthlySavings), icon: PiggyBank, positive: monthlySavings >= 0, action: 'goal' as QuickAction, cta: 'Aggiungi risparmio' },
    { label: 'Spesa/giorno', value: fmt(dailyAvgExpense), icon: BarChart3, positive: false, action: null as QuickAction },
    { label: 'Fine mese', value: fmt(projectedBalance), icon: Calendar, positive: projectedBalance >= 0, action: null as QuickAction },
    { label: 'Risparmi', value: fmt(totalSavings), icon: Target, positive: true, action: 'goal' as QuickAction, cta: 'Aggiungi' },
    { label: 'Debiti', value: fmt(totalDebt), icon: CreditCard, positive: false, action: 'debt' as QuickAction, cta: 'Aggiungi debito' },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="glass-card"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64" /><Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Interactive KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className={`glass-card group transition-all duration-200 ${kpi.action ? 'cursor-pointer hover:ring-2 hover:ring-primary/30 hover:shadow-md' : ''}`}
            onClick={() => kpi.action && setQuickAction(kpi.action)}
          >
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.positive ? 'text-income' : 'text-expense'}`} />
              </div>
              <p className="text-lg font-bold">{kpi.value}</p>
              {'change' in kpi && kpi.change !== undefined && (
                <p className={`text-xs ${kpi.change >= 0 ? 'text-income' : 'text-expense'}`}>
                  {kpi.change >= 0 ? '+' : ''}{kpi.change}% vs mese prec.
                </p>
              )}
              {'sub' in kpi && kpi.sub && (
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              )}
              {kpi.action && kpi.cta && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    <Plus className="w-4 h-4" />{kpi.cta}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {topSpender && (
        <p className="text-xs text-muted-foreground">
          Chi ha speso di più nel mese: <span className="font-medium">{topSpender.userId.slice(0, 8)}…</span> ({fmt(topSpender.amount)}).
        </p>
      )}

      {/* Quick Action Modal */}
      <Dialog open={!!quickAction} onOpenChange={(o) => !o && setQuickAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {quickAction === 'income' && 'Nuova entrata'}
              {quickAction === 'expense' && 'Nuova spesa'}
              {quickAction === 'goal' && 'Aggiungi risparmio'}
              {quickAction === 'debt' && 'Nuovo debito'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {quickAction === 'debt' && (
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={quickForm.name} onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))} placeholder="Es. Prestito auto" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Importo (€)</Label>
              <Input type="number" step="0.01" autoFocus value={quickForm.amount} onChange={e => setQuickForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="text-lg h-12" />
            </div>
            {(quickAction === 'income' || quickAction === 'expense') && (
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={quickForm.category_id} onValueChange={v => setQuickForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === quickAction).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleQuickSubmit} className="w-full">Conferma</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget progress */}
      {totalBudget > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Budget mensile</span>
              <span className={`text-sm font-semibold ${budgetUsed >= 100 ? 'text-expense' : budgetUsed >= 80 ? 'text-warning' : 'text-income'}`}>{budgetUsed}%</span>
            </div>
            <Progress value={budgetUsed} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{fmt(totalExpense)} di {fmt(totalBudget)} utilizzato</p>
          </CardContent>
        </Card>
      )}

      {/* Smart Insights */}
      <SmartInsights
        transactions={transactions}
        categories={categories}
        budgets={budgets}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
      />

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Saldi per account (famiglia)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {accountBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun account configurato</p>
          ) : accountBalances.map((a) => (
            <div key={a.name} className="flex items-center justify-between text-sm">
              <span>{a.name}</span>
              <span className={a.balance >= 0 ? 'text-income font-medium' : 'text-expense font-medium'}>{fmt(a.balance)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Spese per categoria</CardTitle></CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <PiggyBank className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Nessuna spesa questo mese</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setQuickAction('expense')}>
                  <Plus className="w-3 h-3 mr-1" />Aggiungi spesa
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Andamento saldo</CardTitle></CardHeader>
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
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Nessun dato</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Confronto mensile</CardTitle></CardHeader>
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

      {/* Calendar */}
      <FinancialCalendar transactions={transactions} categories={categories} debts={debts} />

      {/* Recent transactions */}
      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ultime transazioni</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Wallet className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Nessuna transazione ancora</p>
              <p className="text-xs mt-1">Usa il pulsante + o premi ⌘K per iniziare</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map(t => {
                const cat = categories.find(c => c.id === t.category_id);
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#888' }} />
                      <div>
                        <p className="text-sm font-medium">{cat?.name || 'Senza categoria'}</p>
                        <p className="text-xs text-muted-foreground">{t.notes || format(parseISO(t.date), 'dd MMM yyyy', { locale: it })}</p>
                      </div>
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
