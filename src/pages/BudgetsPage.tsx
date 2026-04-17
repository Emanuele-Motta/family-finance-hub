import { useMemo, useState } from 'react';
import { useBudgets, useCategories, useTransactions } from '@/hooks/useFinanceData';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';

type BudgetHistoryEntry = {
  id: string;
  category_id: string | null;
  amount: number;
  period: 'monthly' | 'yearly';
  month: string;
  created_at: string;
};

const BUDGET_HISTORY_KEY = 'ff_budget_history_v1';

export default function BudgetsPage() {
  const { budgets, addBudget, deleteBudget } = useBudgets();
  const categories = useCategories();
  const { transactions } = useTransactions();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '', period: 'monthly' as 'monthly' | 'yearly' });
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(BUDGET_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const historyMonths = useMemo(
    () => Array.from({ length: 6 }).map((_, index) => format(subMonths(now, index), 'yyyy-MM')),
    [now],
  );

  const getSpentForCategory = (categoryId: string | null) => {
    return transactions
      .filter(t => {
        const d = parseISO(t.date);
        return t.type === 'expense' && d >= monthStart && d <= monthEnd && (categoryId ? t.category_id === categoryId : true);
      })
      .reduce((s, t) => s + Number(t.amount), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFamilyGroupId) return;
    try {
      await addBudget({
        family_group_id: currentFamilyGroupId,
        category_id: form.category_id || null,
        amount: parseFloat(form.amount),
        period: form.period,
      });
      const nextHistory: BudgetHistoryEntry[] = [
        {
          id: `${Date.now()}-${Math.random()}`,
          category_id: form.category_id || null,
          amount: parseFloat(form.amount),
          period: form.period,
          month: format(new Date(), 'yyyy-MM'),
          created_at: new Date().toISOString(),
        },
        ...budgetHistory,
      ].slice(0, 200);
      setBudgetHistory(nextHistory);
      localStorage.setItem(BUDGET_HISTORY_KEY, JSON.stringify(nextHistory));
      toast({ title: 'Budget aggiunto!' });
      setOpen(false);
      setForm({ category_id: '', amount: '', period: 'monthly' });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const getSpentForMonth = (categoryId: string | null, monthIso: string) => {
    const start = startOfMonth(parseISO(`${monthIso}-01`));
    const end = endOfMonth(parseISO(`${monthIso}-01`));
    return transactions
      .filter((transaction) => {
        const date = parseISO(transaction.date);
        return transaction.type === 'expense' && date >= start && date <= end && (categoryId ? transaction.category_id === categoryId : true);
      })
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gestisci i budget per ogni categoria</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nuovo budget</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo budget</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === 'expense').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Importo (€)</Label>
                <Input type="number" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Periodo</Label>
                <Select value={form.period} onValueChange={(v: 'monthly' | 'yearly') => setForm(f => ({ ...f, period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensile</SelectItem>
                    <SelectItem value="yearly">Annuale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Crea budget</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nessun budget impostato. Crea il primo!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm font-medium">Storico budget mensile</p>
                <Select value={selectedHistoryMonth} onValueChange={setSelectedHistoryMonth}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {historyMonths.map((month) => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {budgetHistory.filter((entry) => entry.month === selectedHistoryMonth).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessuna modifica budget registrata per il mese selezionato.</p>
              ) : (
                <div className="space-y-2">
                  {budgetHistory
                    .filter((entry) => entry.month === selectedHistoryMonth)
                    .slice(0, 12)
                    .map((entry) => {
                      const categoryName = categories.find((category) => category.id === entry.category_id)?.name || 'Globale';
                      return (
                        <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
                          <span>{categoryName} ({entry.period === 'monthly' ? 'mensile' : 'annuale'})</span>
                          <span className="font-medium">{fmt(entry.amount)}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
          {budgets.map(b => {
            const cat = categories.find(c => c.id === b.category_id);
            const spent = getSpentForCategory(b.category_id);
            const pct = Math.min(100, Math.round((spent / Number(b.amount)) * 100));
            const overBudget = pct >= 100;
            const nearBudget = pct >= 80 && pct < 100;
            const avg3m = [0, 1, 2]
              .map((offset) => getSpentForMonth(b.category_id, format(subMonths(now, offset), 'yyyy-MM')))
              .reduce((sum, value) => sum + value, 0) / 3;
            const comparisonDelta = spent - avg3m;

            return (
              <Card key={b.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat?.color || '#888' }} />
                      <span className="text-sm font-medium">{cat?.name || 'Globale'}</span>
                      <span className="text-xs text-muted-foreground capitalize">({b.period === 'monthly' ? 'mensile' : 'annuale'})</span>
                      {nearBudget && !overBudget && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Attenzione 80%</span>}
                      {overBudget && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800">Superato</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      {(overBudget || nearBudget) && (
                        <AlertTriangle className={`w-4 h-4 ${overBudget ? 'text-expense' : 'text-warning'}`} />
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteBudget(b.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={pct} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(spent)} speso</span>
                    <span>{fmt(Number(b.amount))} budget</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Questo mese vs media ultimi 3 mesi: <span className={comparisonDelta > 0 ? 'text-expense font-medium' : 'text-income font-medium'}>{comparisonDelta > 0 ? '+' : ''}{fmt(comparisonDelta)}</span>
                  </p>
                  {overBudget && <p className="text-xs text-expense mt-1 font-medium">⚠️ Budget superato!</p>}
                  {nearBudget && <p className="text-xs text-warning mt-1 font-medium">Attenzione: vicino al limite</p>}
                </CardContent>
              </Card>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
