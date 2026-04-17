import { useState } from 'react';
import { useGoals } from '@/hooks/useFinanceData';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import DatePicker from '@/components/DatePicker';
import { Plus, Trash2, PlusCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [addAmountId, setAddAmountId] = useState<string | null>(null);
  const [addAmountVal, setAddAmountVal] = useState('');
  const [form, setForm] = useState({ name: '', target_amount: '', deadline: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFamilyGroupId) return;
    try {
      await addGoal({
        family_group_id: currentFamilyGroupId,
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: 0,
        deadline: form.deadline || null,
      });
      toast({ title: 'Obiettivo creato!' });
      setOpen(false);
      setForm({ name: '', target_amount: '', deadline: '' });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddAmount = async (goalId: string, current: number) => {
    const val = parseFloat(addAmountVal);
    if (isNaN(val) || val <= 0) return;
    try {
      await updateGoal(goalId, { current_amount: current + val });
      toast({ title: 'Importo aggiunto!' });
      setAddAmountId(null);
      setAddAmountVal('');
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Traccia i tuoi obiettivi di risparmio</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nuovo obiettivo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo obiettivo</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Es. Vacanza estiva" />
              </div>
              <div className="space-y-2">
                <Label>Importo obiettivo (€)</Label>
                <Input type="number" step="0.01" required value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Scadenza (opzionale)</Label>
                <DatePicker value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e }))} placeholder="Seleziona scadenza" isOptional />
              </div>
              <Button type="submit" className="w-full">Crea obiettivo</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nessun obiettivo. Inizia a risparmiare!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map(g => {
            const pct = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100));
            return (
              <Card key={g.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-sm">{g.name}</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddAmountId(addAmountId === g.id ? null : g.id)}>
                        <PlusCircle className="w-4 h-4 text-income" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteGoal(g.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {g.deadline && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Scadenza: {format(parseISO(g.deadline), 'dd MMM yyyy', { locale: it })}
                    </p>
                  )}
                  <Progress value={pct} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(Number(g.current_amount))}</span>
                    <span>{pct}% di {fmt(Number(g.target_amount))}</span>
                  </div>
                  {addAmountId === g.id && (
                    <div className="flex gap-2 mt-3">
                      <Input type="number" step="0.01" placeholder="Importo" value={addAmountVal} onChange={e => setAddAmountVal(e.target.value)} className="h-8 text-sm" />
                      <Button size="sm" className="h-8" onClick={() => handleAddAmount(g.id, Number(g.current_amount))}>Aggiungi</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
