import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTransactions, useCategories, useBudgets, useGoals, useDebts, useAccounts } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardSkeleton } from '@/components/ui/skeleton-layouts';
import SmartInsights from '@/components/SmartInsights';
import NaturalLanguageInsights from '@/components/NaturalLanguageInsights';
import FinancialCalendar from '@/components/FinancialCalendar';
import { TrendingUp, TrendingDown, Wallet, CreditCard, Target, PiggyBank, Plus, BarChart3, Calendar, Repeat, BellRing, SlidersHorizontal, FileText, Share2, AlertCircle, CheckCircle, Lightbulb, ChevronUp, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, getDaysInMonth, getDate } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { getRecurringStats } from '@/services/recurringService';
import type { RecurringOccurrence } from '@/types/finance';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)', 'hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)',
  'hsl(280, 68%, 60%)', 'hsl(340, 75%, 55%)', 'hsl(190, 80%, 45%)',
];

type QuickAction = 'income' | 'expense' | 'goal' | 'debt' | 'account-balance' | null;
const KPI_PREFS_KEY = 'ff_dashboard_kpis_v1';

type KpiId =
  | 'saldo-attuale'
  | 'entrate'
  | 'spese'
  | 'risparmio-rate'
  | 'spesa-giorno'
  | 'totale-transazioni'
  | 'fine-mese'
  | 'risparmi-totali'
  | 'debiti';

interface QuickInsight {
  text: string;
  type: 'success' | 'warning' | 'info';
  iconType: 'alert' | 'check' | 'lightbulb' | 'repeat';
  priority: number;
}

const KPI_ICON_STYLES: Record<KpiId, { chip: string; icon: string }> = {
  'saldo-attuale': { chip: 'bg-sky-500/10', icon: 'text-sky-600' },
  entrate: { chip: 'bg-emerald-500/10', icon: 'text-emerald-600' },
  spese: { chip: 'bg-rose-500/10', icon: 'text-rose-600' },
  'risparmio-rate': { chip: 'bg-teal-500/10', icon: 'text-teal-600' },
  'spesa-giorno': { chip: 'bg-orange-500/10', icon: 'text-orange-600' },
  'totale-transazioni': { chip: 'bg-violet-500/10', icon: 'text-violet-600' },
  'fine-mese': { chip: 'bg-indigo-500/10', icon: 'text-indigo-600' },
  'risparmi-totali': { chip: 'bg-cyan-500/10', icon: 'text-cyan-600' },
  debiti: { chip: 'bg-rose-500/10', icon: 'text-rose-600' },
};

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const { transactions, loading: txLoading, addTransaction } = useTransactions();
  const categories = useCategories();
  const { budgets, loading: budLoading } = useBudgets();
  const { goals, loading: goalLoading, updateGoal, addGoal } = useGoals();
  const { debts, loading: debtLoading, addDebt } = useDebts();
  const { accounts, updateAccount } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();

  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [quickAction, setQuickAction] = useState<QuickAction>(null);
  const [kpiPrefsOpen, setKpiPrefsOpen] = useState(false);
  const [visibleKpis, setVisibleKpis] = useState<KpiId[]>(() => {
    try {
      const raw = localStorage.getItem(KPI_PREFS_KEY);
      if (!raw) return ['saldo-attuale', 'entrate', 'spese', 'risparmio-rate', 'debiti'];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : ['saldo-attuale', 'entrate', 'spese', 'risparmio-rate', 'debiti'];
    } catch {
      return ['saldo-attuale', 'entrate', 'spese', 'risparmio-rate', 'debiti'];
    }
  });
  // Sync KPI prefs from Supabase on mount
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('dashboard_kpis').eq('user_id', user.id).single().then(({ data }) => {
      if (data?.dashboard_kpis && Array.isArray(data.dashboard_kpis) && data.dashboard_kpis.length > 0) {
        const kpisFromDb = data.dashboard_kpis as KpiId[];
        setVisibleKpis(kpisFromDb);
        localStorage.setItem(KPI_PREFS_KEY, JSON.stringify(kpisFromDb));
      }
    });
  }, [user]);

  const [quickGoalMode, setQuickGoalMode] = useState<'add' | 'set'>('add');
  const [mobileSection, setMobileSection] = useState<'overview' | 'charts' | 'activity'>('overview');
  const [quickForm, setQuickForm] = useState({ amount: '', category_id: '', notes: '', name: '' });
  const [recurringStats, setRecurringStats] = useState<{
    totalActive: number;
    monthlyProjected: number;
    nextOccurrences: RecurringOccurrence[];
  }>({ totalActive: 0, monthlyProjected: 0, nextOccurrences: [] });

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
  const recurringExpenseThisMonth = currentMonthTx
    .filter((transaction) => transaction.type === 'expense' && transaction.recurring)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
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

  const primaryAccount = useMemo(() => accounts.find((account) => account.is_primary) || accounts[0] || null, [accounts]);

  // Advanced KPIs
  const dayOfMonth = getDate(now);
  const daysInMonth = getDaysInMonth(now);
  const dailyAvgExpense = dayOfMonth > 0 ? totalExpense / dayOfMonth : 0;
  const monthlySavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0;
  const projectedBalance = totalIncome - (dailyAvgExpense * daysInMonth);

  // All-time balance (sum of all transactions)
  const allTimeBalance = useMemo(() =>
    transactions.reduce((sum, transaction) => {
      const amount = Number(transaction.amount);
      if (transaction.type === 'income') return sum + amount;
      if (transaction.type === 'expense') return sum - amount;
      return sum;
    }, 0),
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
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [currentMonthTx, categories]);

  const balanceTrend = useMemo(() => {
    const currentByDay = new Map<number, number>();
    const prevByDay = new Map<number, number>();

    currentMonthTx
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((transaction) => {
        const day = getDate(parseISO(transaction.date));
        const delta = transaction.type === 'income' ? Number(transaction.amount) : -Number(transaction.amount);
        currentByDay.set(day, (currentByDay.get(day) || 0) + delta);
      });

    prevMonthTx
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((transaction) => {
        const day = getDate(parseISO(transaction.date));
        const delta = transaction.type === 'income' ? Number(transaction.amount) : -Number(transaction.amount);
        prevByDay.set(day, (prevByDay.get(day) || 0) + delta);
      });

    const prevMonthDays = getDaysInMonth(subMonths(now, 1));
    const points: Array<{ day: string; saldo: number; saldoPrev: number }> = [];
    let runningCurrent = 0;
    let runningPrev = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      runningCurrent += currentByDay.get(day) || 0;
      runningPrev += prevByDay.get(Math.min(day, prevMonthDays)) || 0;
      points.push({ day: String(day).padStart(2, '0'), saldo: runningCurrent, saldoPrev: runningPrev });
    }

    return points;
  }, [currentMonthTx, prevMonthTx, daysInMonth, now]);

  // Micro trend data per sparkline nei KPI
  const generateKpiTrendData = useMemo(() => {
    const expenseByDay = new Map<number, number>();
    const incomeByDay = new Map<number, number>();
    const txCountByDay = new Map<number, number>();

    currentMonthTx.forEach((t) => {
      const day = getDate(parseISO(t.date));
      if (t.type === 'expense') expenseByDay.set(day, (expenseByDay.get(day) || 0) + Number(t.amount));
      if (t.type === 'income') incomeByDay.set(day, (incomeByDay.get(day) || 0) + Number(t.amount));
      txCountByDay.set(day, (txCountByDay.get(day) || 0) + 1);
    });

    const lastDays = Math.min(7, dayOfMonth);
    const startDay = Math.max(1, dayOfMonth - lastDays + 1);

    return {
      expenses: Array.from({ length: lastDays }, (_, i) => expenseByDay.get(startDay + i) || 0),
      income: Array.from({ length: lastDays }, (_, i) => incomeByDay.get(startDay + i) || 0),
      txCount: Array.from({ length: lastDays }, (_, i) => txCountByDay.get(startDay + i) || 0),
    };
  }, [currentMonthTx, dayOfMonth]);

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

  const quickInsights = useMemo(() => {
    const expenseDeltaPct = pctChange(totalExpense, prevExpense);
    const topCategory = expenseByCategory[0];
    const topCategoryShare = totalExpense > 0 && topCategory ? Math.round((topCategory.value / totalExpense) * 100) : 0;
    const urgentCategory = categories.find((cat) => cat.name.toLowerCase().includes('alimentari') || cat.name.toLowerCase().includes('cibo'));
    const urgentCategorySpent = urgentCategory 
      ? currentMonthTx.filter(t => t.type === 'expense' && t.category_id === urgentCategory.id).reduce((sum, t) => sum + Number(t.amount), 0)
      : 0;

    const insights: QuickInsight[] = [];

    // Trend spese
    if (expenseDeltaPct > 20) {
      insights.push({
        text: `Le uscite sono ${expenseDeltaPct}% più alte del mese scorso—controlla i costi.`,
        type: 'warning',
        iconType: 'alert',
        priority: 1,
      });
    } else if (expenseDeltaPct < -10) {
      insights.push({
        text: `Ottime notizie: le uscite sono ${Math.abs(expenseDeltaPct)}% più basse del mese scorso.`,
        type: 'success',
        iconType: 'check',
        priority: 2,
      });
    } else {
      insights.push({
        text: `Le uscite sono stabili rispetto al mese scorso (${expenseDeltaPct >= 0 ? '+' : ''}${expenseDeltaPct}%).`,
        type: 'info',
        iconType: 'lightbulb',
        priority: 3,
      });
    }

    // Top categoria
    if (topCategory) {
      insights.push({
        text: `"${topCategory.name}" è il tuo principale flusso di costi (${topCategoryShare}% del totale).`,
        type: topCategoryShare > 40 ? 'warning' : 'info',
        iconType: topCategoryShare > 40 ? 'alert' : 'lightbulb',
        priority: 2,
      });
    }

    // Ricorrenti
    if (recurringStats.totalActive > 0) {
      insights.push({
        text: `${recurringStats.totalActive} pagamenti fissi monitorati—dai uno sguardo al calendario.`,
        type: 'info',
        iconType: 'repeat',
        priority: 3,
      });
    } else {
      insights.push({
        text: `Nessun pagamento ricorrente registrato—ottimo controllo sui costi fissi.`,
        type: 'success',
        iconType: 'check',
        priority: 4,
      });
    }

    // Spesa giornaliera categorie essenziali
    if (urgentCategorySpent > 0) {
      const avgDaily = urgentCategorySpent / dayOfMonth;
      insights.push({
        text: `Spesa media giornaliera in alimentari: €${avgDaily.toFixed(0)}—${avgDaily > 30 ? 'potrebbe scendere.' : 'stai in linea.'}`,
        type: avgDaily > 30 ? 'warning' : 'success',
        iconType: avgDaily > 30 ? 'alert' : 'check',
        priority: urgentCategorySpent > 0 ? 2 : 4,
      });
    }

    // Ordinare per priorità e limitare
    return insights
      .sort((a, b) => a.priority - b.priority)
      .slice(0, isMobile ? 2 : 4);
  }, [totalExpense, prevExpense, expenseByCategory, currentMonthTx, categories, recurringStats.totalActive, dayOfMonth, isMobile]);

  const exportMonthlyPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const monthTitle = format(now, 'MMMM yyyy', { locale: it });
    const lines = [
      `Report mensile FamilyFinance - ${monthTitle}`,
      '',
      `Entrate: ${fmt(totalIncome)}`,
      `Spese: ${fmt(totalExpense)}`,
      `Saldo netto: ${fmt(netBalance)}`,
      `Transazioni mese: ${currentMonthTx.length}`,
      '',
      'Top categorie spesa:',
      ...expenseByCategory.map((item, index) => `${index + 1}. ${item.name}: ${fmt(item.value)}`),
      '',
      'Insight rapidi:',
      ...quickInsights.map((insight, index) => `${index + 1}. ${insight.text}`),
    ];

    let y = 20;
    doc.setFontSize(12);
    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 8;
    });

    doc.save(`report_mensile_${format(now, 'yyyy-MM')}.pdf`);
  };

  const shareMonthlyReport = async () => {
    const shareUrl = `${window.location.origin}/?reportMonth=${format(now, 'yyyy-MM')}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Report mensile FamilyFinance',
          text: `Report aggiornato ${format(now, 'MMMM yyyy', { locale: it })}`,
          url: shareUrl,
        });
        return;
      } catch {
        // fallback su clipboard
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success('Link report copiato');
  };

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetUsed = totalBudget > 0 ? Math.min(100, Math.round((totalExpense / totalBudget) * 100)) : 0;
  const topSpender = useMemo(() => {
    const spent = new Map<string, number>();
    currentMonthTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => spent.set(t.created_by_user_id, (spent.get(t.created_by_user_id) || 0) + Number(t.amount)));
    const [userId, amount] = [...spent.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (!userId) return null;
    const isMe = userId === user?.id;
    const displayName = isMe ? 'Tu' : (memberNames[userId] || userId.slice(0, 8) + '…');
    return { userId, amount: amount || 0, displayName };
  }, [currentMonthTx, user, memberNames]);

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  useEffect(() => {
    if (!currentFamilyGroupId) return;
    (async () => {
      const { data: members } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('family_group_id', currentFamilyGroupId);
      if (!members?.length) return;
      const ids = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ids);
      if (!profiles) return;
      const map: Record<string, string> = {};
      for (const p of profiles) {
        if (p.display_name) map[p.user_id] = p.display_name;
      }
      setMemberNames(map);
    })();
  }, [currentFamilyGroupId]);

  useEffect(() => {
    let isMounted = true;

    const loadRecurringStats = async () => {
      if (!currentFamilyGroupId) {
        if (isMounted) {
          setRecurringStats({ totalActive: 0, monthlyProjected: 0, nextOccurrences: [] });
        }
        return;
      }

      try {
        const stats = await getRecurringStats(currentFamilyGroupId);
        if (isMounted) {
          setRecurringStats(stats);
        }
      } catch {
        if (isMounted) {
          setRecurringStats({ totalActive: 0, monthlyProjected: 0, nextOccurrences: [] });
        }
      }
    };

    loadRecurringStats();

    return () => {
      isMounted = false;
    };
  }, [currentFamilyGroupId, transactions.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'balance') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleQuickSubmit = async () => {
    const preferredAccountId = localStorage.getItem('ff_default_account_id') || '';
    const defaultAccountId = accounts.find((account) => account.id === preferredAccountId)?.id || accounts.find(a => a.is_primary)?.id || accounts[0]?.id;
    if (!user || !currentFamilyGroupId) return;
    if (!quickForm.amount) {
      toast.error('Inserisci un importo');
      return;
    }
    const amount = parseFloat(quickForm.amount);
    if (isNaN(amount) || (quickAction !== 'account-balance' && amount <= 0)) {
      toast.error('Inserisci un importo valido');
      return;
    }

    try {
      if (quickAction === 'income' || quickAction === 'expense') {
        if (!defaultAccountId) {
          toast.error('Crea prima un account per registrare entrate e spese');
          return;
        }

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
      } else if (quickAction === 'goal') {
        if (goals.length > 0) {
          if (quickGoalMode === 'add') {
            await updateGoal(goals[0].id, { current_amount: Number(goals[0].current_amount) + amount });
          } else {
            const currentTotal = goals.reduce((sum, goal) => sum + Number(goal.current_amount), 0);

            if (currentTotal <= 0) {
              const updates = goals.map((goal, index) =>
                updateGoal(goal.id, { current_amount: index === 0 ? amount : 0 })
              );
              await Promise.all(updates);
            } else {
              const factor = amount / currentTotal;
              const updates = goals.map((goal, index) => {
                if (index === goals.length - 1) {
                  const previousTotal = goals
                    .slice(0, -1)
                    .reduce((sum, g) => sum + Number((Number(g.current_amount) * factor).toFixed(2)), 0);
                  return updateGoal(goal.id, { current_amount: Math.max(0, Number((amount - previousTotal).toFixed(2))) });
                }

                return updateGoal(goal.id, {
                  current_amount: Math.max(0, Number((Number(goal.current_amount) * factor).toFixed(2))),
                });
              });

              await Promise.all(updates);
            }
          }
        } else {
          await addGoal({
            family_group_id: currentFamilyGroupId,
            name: 'Risparmi Famiglia',
            target_amount: amount,
            current_amount: amount,
            deadline: null,
          });
        }
        toast.success(quickGoalMode === 'set' ? 'Totale risparmi aggiornato!' : 'Risparmio aggiunto!');
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
      } else if (quickAction === 'account-balance') {
        if (!primaryAccount) {
          toast.error('Nessun conto principale disponibile');
          return;
        }

        await updateAccount(primaryAccount.id, { balance: amount });
        toast.success('Saldo del conto principale aggiornato!');
      }
      setQuickAction(null);
      setQuickGoalMode('add');
      setQuickForm({ amount: '', category_id: '', notes: '', name: '' });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loading = txLoading || budLoading || goalLoading || debtLoading;

  const kpis = [
    { id: 'saldo-attuale' as KpiId, label: 'Patrimonio netto', value: fmt(allTimeBalance), icon: Wallet, positive: allTimeBalance >= 0, action: 'account-balance' as QuickAction, cta: 'Aggiorna saldo conto' },
    { id: 'entrate' as KpiId, label: 'Entrate del mese', value: fmt(totalIncome), change: pctChange(totalIncome, prevIncome), icon: TrendingUp, positive: true, action: 'income' as QuickAction, cta: 'Registra entrata' },
    { id: 'spese' as KpiId, label: 'Uscite del mese', value: fmt(totalExpense), change: pctChange(totalExpense, prevExpense), icon: TrendingDown, positive: false, action: 'expense' as QuickAction, cta: 'Registra spesa' },
    { id: 'risparmio-rate' as KpiId, label: 'Tasso di risparmio', value: `${savingsRate.toFixed(0)}%`, sub: fmt(monthlySavings), icon: PiggyBank, positive: monthlySavings >= 0, action: 'goal' as QuickAction, cta: 'Aggiorna risparmi' },
    { id: 'totale-transazioni' as KpiId, label: 'Movimenti del mese', value: String(currentMonthTx.length), icon: BarChart3, positive: true, action: null as QuickAction },
    { id: 'spesa-giorno' as KpiId, label: 'Media spesa giornaliera', value: fmt(dailyAvgExpense), icon: BarChart3, positive: false, action: null as QuickAction },
    { id: 'fine-mese' as KpiId, label: 'Stima fine mese', value: fmt(projectedBalance), icon: Calendar, positive: projectedBalance >= 0, action: null as QuickAction },
    { id: 'risparmi-totali' as KpiId, label: 'Risparmi accumulati', value: fmt(totalSavings), icon: Target, positive: true, action: 'goal' as QuickAction, cta: 'Aggiungi risparmio' },
    { id: 'debiti' as KpiId, label: 'Debito residuo', value: fmt(totalDebt), icon: CreditCard, positive: false, action: 'debt' as QuickAction, cta: 'Registra debito' },
  ];

  const visibleKpiCards = kpis.filter((kpi) => visibleKpis.includes(kpi.id));
  const mobileKpiCards = visibleKpiCards.slice(0, 4);

  const toggleKpi = (id: KpiId) => {
    setVisibleKpis((prev) => {
      const next = prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id];
      localStorage.setItem(KPI_PREFS_KEY, JSON.stringify(next));
      if (user) {
        supabase.from('profiles').update({ dashboard_kpis: next }).eq('user_id', user.id);
      }
      return next;
    });
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={`animate-fade-in ${isMobile ? 'space-y-4' : 'space-y-6'}`}>
      {isMobile && (
        <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setMobileSection('overview')}
            className={`h-8 rounded-lg text-xs font-medium ${mobileSection === 'overview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Panoramica
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('charts')}
            className={`h-8 rounded-lg text-xs font-medium ${mobileSection === 'charts' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Grafici
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('activity')}
            className={`h-8 rounded-lg text-xs font-medium ${mobileSection === 'activity' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            Attivita
          </button>
        </div>
      )}

      {/* Interactive KPIs */}
      {(!isMobile || mobileSection === 'overview') && (
      <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Cruscotto del mese</h2>
          <p className="text-xs text-muted-foreground">Panoramica aggiornata a {format(now, 'dd MMMM yyyy', { locale: it })}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button type="button" size="sm" variant="outline" onClick={exportMonthlyPdf}>
            <FileText className="w-4 h-4 sm:mr-1 text-sky-600" /><span className="hidden sm:inline">Esporta PDF</span>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={shareMonthlyReport}>
            <Share2 className="w-4 h-4 sm:mr-1 text-indigo-600" /><span className="hidden sm:inline">Condividi</span>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setKpiPrefsOpen(true)}>
            <SlidersHorizontal className="w-4 h-4 sm:mr-1 text-violet-600" /><span className="hidden sm:inline">Personalizza</span>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-2 min-[980px]:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
        {(isMobile ? mobileKpiCards : visibleKpiCards).map((kpi, idx) => {
          const trendData = kpi.id === 'spese' ? generateKpiTrendData.expenses 
            : kpi.id === 'entrate' ? generateKpiTrendData.income 
            : kpi.id === 'totale-transazioni' ? generateKpiTrendData.txCount 
            : [];
          const maxTrend = trendData.length > 0 ? Math.max(...trendData, 1) : 1;
          const hasChange = 'change' in kpi && kpi.change !== undefined;
          
          return (
            <Card
              key={kpi.label}
              className={`${isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card min-h-[132px] lg:min-h-[144px]'} group transition-all duration-200 animate-fade-in-up ${kpi.action ? 'cursor-pointer hover:ring-2 hover:ring-primary/30 hover:shadow-md hover:scale-105' : ''}`}
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => kpi.action && setQuickAction(kpi.action)}
            >
              <CardContent className={`${isMobile ? 'p-3' : 'p-5 lg:p-6'} relative`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  <span className={`inline-flex items-center justify-center rounded-md w-7 h-7 ${KPI_ICON_STYLES[kpi.id].chip} group-hover:scale-110 transition-transform`}>
                    <kpi.icon className={`w-4 h-4 ${KPI_ICON_STYLES[kpi.id].icon}`} />
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className={`${isMobile ? 'text-lg' : 'text-xl lg:text-2xl'} font-bold leading-tight`}>{kpi.value}</p>
                  {hasChange && (
                    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${kpi.change >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>
                      {kpi.change >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>{Math.abs(kpi.change)}%</span>
                    </div>
                  )}
                </div>
                {'sub' in kpi && kpi.sub && (
                  <p className="text-xs text-muted-foreground mb-2">Risparmio netto: {kpi.sub}</p>
                )}
                {trendData.length > 0 && (
                  <div className="flex items-end gap-1 h-8">
                    {trendData.map((value, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t transition-all group-hover:opacity-100 ${kpi.id === 'entrate' ? 'bg-income/70 hover:bg-income' : kpi.id === 'spese' ? 'bg-expense/70 hover:bg-expense' : 'bg-primary/70 hover:bg-primary'}`}
                        style={{ height: `${Math.max((value / maxTrend) * 100, 15)}%` }}
                        title={`${Math.round(value)}`}
                      />
                    ))}
                  </div>
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
          );
        })}
      </div>
      {!isMobile && topSpender && (
        <p className="text-xs text-muted-foreground">
          Chi ha speso di più nel mese: <span className="font-medium">{topSpender.displayName}</span> ({fmt(topSpender.amount)}).
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {quickInsights.map((insight, index) => {
          const iconMap = {
            alert: <AlertCircle className="w-4 h-4" />,
            check: <CheckCircle className="w-4 h-4" />,
            lightbulb: <Lightbulb className="w-4 h-4" />,
            repeat: <Repeat className="w-4 h-4" />,
          };
          return (
            <Card key={index} className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className={cn(
                    'flex-shrink-0 rounded-full p-1.5 mt-0.5',
                    insight.type === 'success' && 'bg-emerald-500/15 text-emerald-600',
                    insight.type === 'warning' && 'bg-amber-500/15 text-amber-600',
                    insight.type === 'info' && 'bg-blue-500/15 text-blue-600',
                  )}>
                    {iconMap[insight.iconType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium leading-snug',
                      insight.type === 'success' && 'text-emerald-700 dark:text-emerald-400',
                      insight.type === 'warning' && 'text-amber-700 dark:text-amber-400',
                      insight.type === 'info' && 'text-blue-700 dark:text-blue-400',
                    )}>
                      {insight.text}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary" />
              Spese Fisse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Proiezione mensile</span>
              <span className="font-semibold">{fmt(recurringStats.monthlyProjected || recurringExpenseThisMonth)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Abbonamenti attivi</span>
              <Badge variant="secondary">{recurringStats.totalActive}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Addebitato questo mese</span>
              <span className="font-medium">{fmt(recurringExpenseThisMonth)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BellRing className="w-4 h-4 text-primary" />
              Prossimi Addebiti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recurringStats.nextOccurrences.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun addebito ricorrente previsto nei prossimi 30 giorni.</p>
            ) : (
              recurringStats.nextOccurrences.map((occurrence) => (
                <div key={occurrence.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{format(parseISO(occurrence.occurrence_date), 'dd MMM yyyy', { locale: it })}</p>
                    <p className="text-xs text-muted-foreground">Addebito ricorrente pianificato</p>
                  </div>
                  <Badge variant="outline">In arrivo</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {/* Quick Action Modal */}
      <Dialog open={!!quickAction} onOpenChange={(o) => !o && setQuickAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {quickAction === 'income' && 'Nuova entrata'}
              {quickAction === 'expense' && 'Nuova spesa'}
              {quickAction === 'goal' && 'Gestisci risparmi'}
              {quickAction === 'debt' && 'Nuovo debito'}
              {quickAction === 'account-balance' && 'Imposta saldo conto principale'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {quickAction === 'account-balance' && (
              <p className="text-xs text-muted-foreground">
                Conto selezionato: <span className="font-medium">{primaryAccount?.name || 'Nessun conto principale'}</span>
              </p>
            )}
            {quickAction === 'debt' && (
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={quickForm.name} onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))} placeholder="Es. Prestito auto" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{quickAction === 'account-balance' ? 'Saldo attuale (€)' : 'Importo (€)'}</Label>
              <Input type="number" step="0.01" autoFocus value={quickForm.amount} onChange={e => setQuickForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="text-lg h-12" />
            </div>
            {quickAction === 'goal' && (
              <div className="space-y-1">
                <Label className="text-xs">Modalità</Label>
                <Select value={quickGoalMode} onValueChange={(value: 'add' | 'set') => setQuickGoalMode(value)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Aggiungi ai risparmi</SelectItem>
                    <SelectItem value="set">Imposta totale risparmi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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

      <Dialog open={kpiPrefsOpen} onOpenChange={setKpiPrefsOpen}>
        <DialogContent className="sm:max-w-md max-w-none w-screen sm:w-auto h-[100dvh] sm:h-auto rounded-none sm:rounded-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizza KPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {kpis.map((kpi) => (
              <label key={kpi.id} className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleKpis.includes(kpi.id)}
                  onChange={() => toggleKpi(kpi.id)}
                />
                <span className="text-sm">{kpi.label}</span>
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget progress */}
      {(!isMobile || mobileSection === 'overview') && totalBudget > 0 && (
        <Card className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
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
      {(!isMobile || mobileSection === 'activity') && (
      <SmartInsights
        transactions={transactions}
        categories={categories}
        budgets={budgets}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
      />
      )}

      {(!isMobile || mobileSection === 'activity') && (
      <Card className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
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
      )}

      {/* Charts */}
      {(!isMobile || mobileSection === 'charts') && (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Spese per categoria</CardTitle></CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
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

        <Card className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Trend entrate vs uscite</CardTitle></CardHeader>
          <CardContent>
            {(monthlyComparison.length > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="entrate" name="Entrate" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="spese" name="Spese" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Dati insufficienti per il trend</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`${isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'} md:col-span-2 lg:col-span-1`}>
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
      )}

      {/* Calendar */}
      {(!isMobile || mobileSection === 'charts') && (
        <FinancialCalendar transactions={transactions} categories={categories} debts={debts} />
      )}

      {/* Recent transactions */}
      {(!isMobile || mobileSection === 'activity') && (
      <Card className={isMobile ? 'border border-border/70 bg-card shadow-none' : 'glass-card'}>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ultime transazioni</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Wallet className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Nessuna transazione registrata</p>
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
      )}

      {(!isMobile || mobileSection === 'activity') && (
        <NaturalLanguageInsights transactions={transactions} categories={categories} />
      )}
    </div>
  );
}
