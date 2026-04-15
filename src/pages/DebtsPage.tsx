import { useState } from 'react';
import { useDebts } from '@/hooks/useFinanceData';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Check } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { it } from 'date-fns/locale';

export default function DebtsPage() {
  const { debts, addDebt, updateDebt, deleteDebt } = useDebts();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', total_amount: '', remaining_amount: '', due_date: '', interest_rate: '', monthly_payment: '', notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFamilyGroupId) return;
    try {
      await addDebt({
        family_group_id: currentFamilyGroupId,
        name: form.name,
        total_amount: parseFloat(form.total_amount),
        remaining_amount: parseFloat(form.remaining_amount || form.total_amount),
        due_date: form.due_date || null,
        interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
        monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null,
        notes: form.notes || null,
        is_paid: false,
      });
      toast({ title: 'Debito aggiunto!' });
      setOpen(false);
      setForm({ name: '', total_amount: '', remaining_amount: '', due_date: '', interest_rate: '', monthly_payment: '', notes: '' });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const markPaid = async (id: string) => {
    await updateDebt(id, { is_paid: true, remaining_amount: 0 });
    toast({ title: 'Debito saldato!' });
  };

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const activeDebts = debts.filter(d => !d.is_paid);
  const paidDebts = debts.filter(d => d.is_paid);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gestisci i tuoi debiti e rate</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nuovo debito</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo debito</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Es. Mutuo casa" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Importo totale (€)</Label>
                  <Input type="number" step="0.01" required value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Residuo (€)</Label>
                  <Input type="number" step="0.01" value={form.remaining_amount} onChange={e => setForm(f => ({ ...f, remaining_amount: e.target.value }))} placeholder="Uguale al totale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rata mensile (€)</Label>
                  <Input type="number" step="0.01" value={form.monthly_payment} onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tasso (%)</Label>
                  <Input type="number" step="0.01" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Scadenza</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full">Aggiungi debito</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {activeDebts.length === 0 && paidDebts.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nessun debito registrato</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeDebts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {activeDebts.map(d => {
                const paidPct = Math.round(((Number(d.total_amount) - Number(d.remaining_amount)) / Number(d.total_amount)) * 100);
                const overdue = d.due_date && isPast(parseISO(d.due_date));
                return (
                  <Card key={d.id} className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm">{d.name}</h3>
                        <div className="flex items-center gap-1">
                          {overdue && <Badge variant="destructive" className="text-xs">Scaduto</Badge>}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-income" onClick={() => markPaid(d.id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteDebt(d.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Progress value={paidPct} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Residuo: {fmt(Number(d.remaining_amount))}</span>
                        <span>Totale: {fmt(Number(d.total_amount))}</span>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        {d.monthly_payment && <span>Rata: {fmt(Number(d.monthly_payment))}/mese</span>}
                        {d.interest_rate && <span>Tasso: {Number(d.interest_rate)}%</span>}
                        {d.due_date && <span>Scade: {format(parseISO(d.due_date), 'dd/MM/yyyy')}</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {paidDebts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Debiti saldati</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {paidDebts.map(d => (
                  <Card key={d.id} className="glass-card opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-income" />
                          <span className="text-sm font-medium line-through">{d.name}</span>
                        </div>
                        <span className="text-sm">{fmt(Number(d.total_amount))}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
