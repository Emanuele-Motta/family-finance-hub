// Author: Emanuele Motta
// Date: 16-Apr-2026

import { useMemo, useState } from 'react';
import { useRecurringTemplates, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import DatePicker from '@/components/DatePicker';
import { TransactionListSkeleton } from '@/components/ui/skeleton-layouts';
import { CalendarRange, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import type { RecurringTemplate } from '@/types/finance';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

type SubscriptionForm = {
  name: string;
  amount: string;
  category_id: string;
  account_id: string;
  starts_at: string;
  frequency: 'monthly' | 'yearly';
  description: string;
  is_active: boolean;
};

const initialForm: SubscriptionForm = {
  name: '',
  amount: '',
  category_id: '',
  account_id: '',
  starts_at: new Date().toISOString().split('T')[0],
  frequency: 'monthly',
  description: '',
  is_active: true,
};

function projectMonthlyAmount(template: RecurringTemplate) {
  if (template.frequency === 'yearly') {
    return Number(template.amount) / 12;
  }

  return Number(template.amount);
}

export default function SubscriptionsPage() {
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate, toggleTemplate } = useRecurringTemplates();
  const categories = useCategories();
  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubscriptionForm>(initialForm);

  const expenseCategories = categories.filter((category) => category.type === 'expense');

  const stats = useMemo(() => {
    const active = templates.filter((template) => template.is_active);
    const monthlyProjection = active.reduce((sum, template) => sum + projectMonthlyAmount(template), 0);

    return {
      total: templates.length,
      active: active.length,
      paused: templates.length - active.length,
      monthlyProjection,
    };
  }, [templates]);

  const fmt = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (template: RecurringTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      amount: String(template.amount),
      category_id: template.category_id || '',
      account_id: template.account_id,
      starts_at: template.starts_at,
      frequency: template.frequency === 'yearly' ? 'yearly' : 'monthly',
      description: template.description || '',
      is_active: template.is_active,
    });
    setOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentFamilyGroupId || !user) {
      toast({ title: 'Sessione non valida', description: 'Ricarica la pagina e riprova.', variant: 'destructive' });
      return;
    }

    const amount = Number(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: 'Importo non valido', description: 'Inserisci un importo maggiore di zero.', variant: 'destructive' });
      return;
    }

    const accountId = form.account_id || accounts.find((account) => account.is_primary)?.id || accounts[0]?.id;
    if (!accountId) {
      toast({ title: 'Account mancante', description: 'Crea o seleziona un account prima di salvare.', variant: 'destructive' });
      return;
    }

    const dayOfMonth = Math.min(31, Math.max(1, Number(form.starts_at.split('-')[2] || '1')));

    try {
      if (editingId) {
        await updateTemplate(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || form.name.trim(),
          amount,
          category_id: form.category_id || null,
          account_id: accountId,
          frequency: form.frequency,
          day_of_month: dayOfMonth,
          starts_at: form.starts_at,
          is_active: form.is_active,
          tags: ['subscription'],
        });
        toast({ title: 'Abbonamento aggiornato' });
      } else {
        await addTemplate({
          family_group_id: currentFamilyGroupId,
          name: form.name.trim(),
          description: form.description.trim() || form.name.trim(),
          frequency: form.frequency,
          interval: 1,
          day_of_month: dayOfMonth,
          day_of_week: null,
          months: null,
          category_id: form.category_id || null,
          account_id: accountId,
          to_account_id: null,
          amount,
          type: 'expense',
          tags: ['subscription'],
          starts_at: form.starts_at,
          ends_at: null,
          max_occurrences: null,
          notify_days_before: 3,
          notify_method: 'all',
          is_active: form.is_active,
          created_by: user.id,
        });
        toast({ title: 'Abbonamento creato' });
      }

      setOpen(false);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Si è verificato un errore inatteso.';
      toast({ title: 'Errore', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
      toast({ title: 'Abbonamento eliminato' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Si è verificato un errore inatteso.';
      toast({ title: 'Errore', description: message, variant: 'destructive' });
    }
  };

  const handleToggle = async (template: RecurringTemplate) => {
    try {
      await toggleTemplate(template.id, !template.is_active);
      toast({ title: template.is_active ? 'Abbonamento in pausa' : 'Abbonamento riattivato' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Si è verificato un errore inatteso.';
      toast({ title: 'Errore', description: message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Abbonamenti</h2>
          <p className="text-sm text-muted-foreground">Gestisci spese fisse mensili e annuali con calendario ricorrente.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-1" />Nuovo abbonamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica abbonamento' : 'Nuovo abbonamento'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome servizio</Label>
                <Input required value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder="Es. Netflix, palestra, internet casa" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Importo</Label>
                  <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Frequenza</Label>
                  <Select value={form.frequency} onValueChange={(value: 'monthly' | 'yearly') => setForm((current) => ({ ...current, frequency: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensile</SelectItem>
                      <SelectItem value="yearly">Annuale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(value) => setForm((current) => ({ ...current, category_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select value={form.account_id} onValueChange={(value) => setForm((current) => ({ ...current, account_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prima data di addebito</Label>
                <DatePicker value={form.starts_at} onChange={(date) => setForm((current) => ({ ...current, starts_at: date }))} placeholder="Seleziona data" />
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Input value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="Opzionale" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Abbonamento attivo</p>
                  <p className="text-xs text-muted-foreground">Se disattivato, non verranno creati nuovi addebiti futuri.</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))} />
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Salva modifiche' : 'Crea abbonamento'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 min-[980px]:grid-cols-3">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Abbonamenti attivi</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.active}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Proiezione mensile</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(stats.monthlyProjection)}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">In pausa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.paused}</p></CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <TransactionListSkeleton count={3} />
            </div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Repeat className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nessun abbonamento configurato.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servizio</TableHead>
                  <TableHead>Frequenza</TableHead>
                  <TableHead>Prossimo ciclo</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.description || 'Nessuna descrizione'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <CalendarRange className="w-3 h-3" />
                        {template.frequency === 'yearly' ? 'Annuale' : 'Mensile'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {template.frequency === 'yearly'
                        ? format(parseISO(template.starts_at), 'dd MMM yyyy', { locale: it })
                        : `Giorno ${String(template.day_of_month || parseISO(template.starts_at).getDate()).padStart(2, '0')}`}
                    </TableCell>
                    <TableCell>{fmt(Number(template.amount))}</TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'outline'}>
                        {template.is_active ? 'Attivo' : 'In pausa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleToggle(template)}>
                          <Repeat className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(template.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
