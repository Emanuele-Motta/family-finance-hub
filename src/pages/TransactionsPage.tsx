import { useState } from 'react';
import { useTransactions, useCategories } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Filter, ArrowLeftRight } from 'lucide-react';
import CsvImport from '@/components/CsvImport';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function TransactionsPage() {
  const { transactions, addTransaction, deleteTransaction } = useTransactions();
  const categories = useCategories();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [form, setForm] = useState({
    amount: '', type: 'expense' as 'income' | 'expense', category_id: '', date: new Date().toISOString().split('T')[0], notes: '', recurring: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentFamilyGroupId) return;
    try {
      await addTransaction({
        family_group_id: currentFamilyGroupId,
        user_id: user.id,
        category_id: form.category_id || null,
        amount: parseFloat(form.amount),
        type: form.type,
        date: form.date,
        notes: form.notes || null,
        recurring: form.recurring,
        recurrence_type: null,
        tags: null,
      });
      toast({ title: 'Transazione aggiunta!' });
      setOpen(false);
      setForm({ amount: '', type: 'expense', category_id: '', date: new Date().toISOString().split('T')[0], notes: '', recurring: false });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast({ title: 'Transazione eliminata' });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false;
    return true;
  });

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              <SelectItem value="income">Entrate</SelectItem>
              <SelectItem value="expense">Spese</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <CsvImport />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nuova</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova transazione</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Importo (€)</Label>
                  <Input type="number" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v: 'income' | 'expense') => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Spesa</SelectItem>
                      <SelectItem value="income">Entrata</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === form.type).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opzionale" />
              </div>
              <Button type="submit" className="w-full">Aggiungi transazione</Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Transactions list */}
      <Card className="glass-card">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nessuna transazione trovata</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(t => {
                const cat = categories.find(c => c.id === t.category_id);
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#888' }} />
                      <div>
                        <p className="text-sm font-medium">{cat?.name || 'Senza categoria'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(t.date), 'dd MMM yyyy', { locale: it })}
                          {t.notes && ` · ${t.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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
