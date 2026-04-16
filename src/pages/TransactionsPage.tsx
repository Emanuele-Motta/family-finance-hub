import { useState } from 'react';
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Filter } from 'lucide-react';
import CsvImport from '@/components/CsvImport';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function TransactionsPage() {
  const { transactions, addTransaction, deleteTransaction } = useTransactions();
  const categories = useCategories();
  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [form, setForm] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    category_id: '',
    account_id: '',
    to_account_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    recurring: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaultAccountId = form.account_id || accounts.find(a => a.is_primary)?.id || accounts[0]?.id;
    if (!user || !currentFamilyGroupId || !defaultAccountId) return;
    try {
      await addTransaction({
        family_group_id: currentFamilyGroupId,
        user_id: user.id,
        created_by_user_id: user.id,
        paid_by_user_id: user.id,
        category_id: form.type === 'transfer' ? null : form.category_id || null,
        account_id: defaultAccountId,
        to_account_id: form.type === 'transfer' ? form.to_account_id || null : null,
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
      setForm({ amount: '', type: 'expense', category_id: '', account_id: '', to_account_id: '', date: new Date().toISOString().split('T')[0], notes: '', recurring: false });
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
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="income">Entrate</SelectItem>
                <SelectItem value="expense">Spese</SelectItem>
                <SelectItem value="transfer">Trasferimenti</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <CsvImport />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-1" />Nuova</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[88vh]">
              <DialogHeader><DialogTitle>Nuova transazione</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Importo (€)</Label>
                    <Input type="number" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v: 'income' | 'expense' | 'transfer') => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Spesa</SelectItem>
                        <SelectItem value="income">Entrata</SelectItem>
                        <SelectItem value="transfer">Trasferimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account origine</Label>
                  <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.type === 'transfer' && (
                  <div className="space-y-2">
                    <Label>Account destinazione</Label>
                    <Select value={form.to_account_id} onValueChange={v => setForm(f => ({ ...f, to_account_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Seleziona account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.id !== (form.account_id || accounts[0]?.id)).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.type !== 'transfer' && (
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c.type === form.type).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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

      <Card className="glass-card">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nessuna transazione trovata</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(t => {
                const cat = categories.find(c => c.id === t.category_id);
                const account = accounts.find(a => a.id === t.account_id);
                return (
                  <div key={t.id} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: cat?.color || '#888' }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.type === 'transfer' ? 'Trasferimento interno' : (cat?.name || 'Senza categoria')}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {format(parseISO(t.date), 'dd MMM yyyy', { locale: it })}
                            {account?.name ? ` · ${account.name}` : ''}
                            {t.notes ? ` · ${t.notes}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : 'text-primary'}`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔'}{fmt(Number(t.amount))}
                      </span>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-4 h-4" />
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
