import { useState } from 'react';
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
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

export default function BudgetsPage() {
  const { budgets, addBudget, deleteBudget } = useBudgets();
  const categories = useCategories();
  const { transactions } = useTransactions();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '', period: 'monthly' as 'monthly' | 'yearly' });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

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
      toast({ title: 'Budget aggiunto!' });
      setOpen(false);
      setForm({ category_id: '', amount: '', period: 'monthly' });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

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
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map(b => {
            const cat = categories.find(c => c.id === b.category_id);
            const spent = getSpentForCategory(b.category_id);
            const pct = Math.min(100, Math.round((spent / Number(b.amount)) * 100));
            const overBudget = pct >= 100;
            const nearBudget = pct >= 80 && pct < 100;

            return (
              <Card key={b.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat?.color || '#888' }} />
                      <span className="text-sm font-medium">{cat?.name || 'Globale'}</span>
                      <span className="text-xs text-muted-foreground capitalize">({b.period === 'monthly' ? 'mensile' : 'annuale'})</span>
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
                  {overBudget && <p className="text-xs text-expense mt-1 font-medium">⚠️ Budget superato!</p>}
                  {nearBudget && <p className="text-xs text-warning mt-1 font-medium">Attenzione: vicino al limite</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
