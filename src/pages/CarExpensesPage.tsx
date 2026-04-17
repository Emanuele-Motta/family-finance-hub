// Author: Emanuele Motta
// Date: 16-Apr-2026

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { useCarExpensesSettings, getCarDisplayName } from '@/hooks/useCarExpensesSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import DatePicker from '@/components/DatePicker';
import { Car, Shield, Fuel, Wrench, CircleDollarSign, GaugeCircle, Plus } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { it } from 'date-fns/locale';

const CAR_SUBCATEGORIES = [
  { name: 'Assicurazione', icon: Shield, color: '#3b82f6' },
  { name: 'Benzina', icon: Fuel, color: '#ef4444' },
  { name: 'Cambio gomme', icon: Car, color: '#f59e0b' },
  { name: 'Manutenzione', icon: Wrench, color: '#10b981' },
  { name: 'Bollo', icon: CircleDollarSign, color: '#6366f1' },
  { name: 'Revisione', icon: GaugeCircle, color: '#14b8a6' },
];

export default function CarExpensesPage() {
  const { transactions, addTransaction } = useTransactions();
  const categories = useCategories();
  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();
  const { settings: carSettings } = useCarExpensesSettings(currentFamilyGroupId);
  const { toast } = useToast();

  const [form, setForm] = useState({
    car: '',
    subcategory: 'Benzina',
    amount: '',
    account_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const configuredCars = useMemo(
    () => (carSettings.cars.length > 0 ? carSettings.cars : [{ id: 'auto-principale', brand: 'Auto', model: 'principale', nickname: 'Auto principale', logoUrl: null }]),
    [carSettings.cars]
  );

  useEffect(() => {
    if (!form.car && configuredCars[0]?.id) {
      setForm((current) => ({ ...current, car: configuredCars[0].id }));
    }
  }, [configuredCars, form.car]);

  const carCategoryByName = useMemo(() => {
    const map = new Map<string, { id: string; color: string }>();
    for (const sub of CAR_SUBCATEGORIES) {
      const existing = categories.find((category) => category.type === 'expense' && category.name.toLowerCase() === sub.name.toLowerCase());
      if (existing) {
        map.set(sub.name, { id: existing.id, color: existing.color || sub.color });
      }
    }
    return map;
  }, [categories]);

  const carCategoryIds = useMemo(() => new Set(Array.from(carCategoryByName.values()).map((item) => item.id)), [carCategoryByName]);

  const carExpenses = useMemo(
    () => transactions
      .filter((transaction) => transaction.type === 'expense' && (transaction.tags || []).includes('car-expense'))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const monthlyTotal = useMemo(
    () => carExpenses
      .filter((expense) => {
        const date = parseISO(expense.date);
        return date >= monthStart && date <= monthEnd;
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0),
    [carExpenses, monthStart, monthEnd]
  );

  const yearlyTotal = useMemo(
    () => carExpenses
      .filter((expense) => {
        const date = parseISO(expense.date);
        return date >= yearStart && date <= yearEnd;
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0),
    [carExpenses, yearStart, yearEnd]
  );

  const bySubcategory = useMemo(() => {
    const totals = new Map<string, number>();
    carExpenses.forEach((expense) => {
      const categoryName = categories.find((category) => category.id === expense.category_id)?.name || 'Altro';
      totals.set(categoryName, (totals.get(categoryName) || 0) + Number(expense.amount));
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [carExpenses, categories]);

  const byCar = useMemo(() => {
    const totals = new Map<string, number>();
    carExpenses.forEach((expense) => {
      const carIdTag = (expense.tags || []).find((tag) => tag.startsWith('car-id:'));
      const legacyCarTag = (expense.tags || []).find((tag) => tag.startsWith('car:'));
      const carId = carIdTag ? carIdTag.slice(7) : null;
      const carSlug = legacyCarTag ? legacyCarTag.slice(4) : null;
      const matched = configuredCars.find((car) => car.id === carId || getCarDisplayName(car).toLowerCase().replace(/\s+/g, '-') === carSlug);
      const readable = matched ? getCarDisplayName(matched) : 'Auto principale';
      totals.set(readable, (totals.get(readable) || 0) + Number(expense.amount));
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [carExpenses, configuredCars]);

  const perCarOverview = useMemo(() => {
    return configuredCars.map((car) => {
      const monthly = carExpenses
        .filter((expense) => {
          const tags = expense.tags || [];
          const hasCarId = tags.includes(`car-id:${car.id}`);
          const hasLegacySlug = tags.includes(`car:${getCarDisplayName(car).toLowerCase().replace(/\s+/g, '-')}`);
          const date = parseISO(expense.date);
          return (hasCarId || hasLegacySlug) && date >= monthStart && date <= monthEnd;
        })
        .reduce((sum, expense) => sum + Number(expense.amount), 0);

      const yearly = carExpenses
        .filter((expense) => {
          const tags = expense.tags || [];
          const hasCarId = tags.includes(`car-id:${car.id}`);
          const hasLegacySlug = tags.includes(`car:${getCarDisplayName(car).toLowerCase().replace(/\s+/g, '-')}`);
          const date = parseISO(expense.date);
          return (hasCarId || hasLegacySlug) && date >= yearStart && date <= yearEnd;
        })
        .reduce((sum, expense) => sum + Number(expense.amount), 0);

      return { car, monthly, yearly };
    });
  }, [configuredCars, carExpenses, monthStart, monthEnd, yearStart, yearEnd]);

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const getOrCreateSubcategory = async (name: string) => {
    const existing = categories.find((category) => category.type === 'expense' && category.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    if (!currentFamilyGroupId) throw new Error('Gruppo famiglia non disponibile.');

    const preset = CAR_SUBCATEGORIES.find((subcategory) => subcategory.name === name);
    const { data, error } = await supabase
      .from('categories')
      .insert({
        family_group_id: currentFamilyGroupId,
        name,
        icon: 'car',
        type: 'expense',
        color: preset?.color ?? '#64748b',
        is_default: false,
      } as never)
      .select('id')
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !currentFamilyGroupId) {
      toast({ title: 'Sessione non valida', description: 'Ricarica la pagina e riprova.', variant: 'destructive' });
      return;
    }

    const accountId = form.account_id || accounts.find((account) => account.is_primary)?.id || accounts[0]?.id;
    if (!accountId) {
      toast({ title: 'Account mancante', description: 'Crea o seleziona un account prima di salvare.', variant: 'destructive' });
      return;
    }

    const amount = Number(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: 'Importo non valido', description: 'Inserisci un importo maggiore di zero.', variant: 'destructive' });
      return;
    }

    try {
      const selectedCar = configuredCars.find((car) => car.id === form.car) || configuredCars[0];
      const carSlug = getCarDisplayName(selectedCar).toLowerCase().trim().replace(/\s+/g, '-');
      const categoryId = await getOrCreateSubcategory(form.subcategory);

      await addTransaction({
        family_group_id: currentFamilyGroupId,
        user_id: user.id,
        created_by_user_id: user.id,
        paid_by_user_id: user.id,
        category_id: categoryId,
        account_id: accountId,
        to_account_id: null,
        amount,
        type: 'expense',
        date: form.date,
        notes: form.notes || null,
        recurring: false,
        recurrence_type: null,
        tags: ['car-expense', `car-id:${selectedCar.id}`, `car:${carSlug}`, `car-sub:${form.subcategory.toLowerCase().replace(/\s+/g, '-')}`],
      });

      toast({ title: 'Spesa auto salvata!' });
      setForm((current) => ({ ...current, amount: '', notes: '' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Si è verificato un errore inatteso.';
      toast({ title: 'Errore', description: message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {!carSettings.enabled && (
        <Card className="glass-card border-warning/40">
          <CardContent className="py-5">
            <p className="text-sm">La sezione Spese Auto è disattivata.</p>
            <p className="text-xs text-muted-foreground mt-1">Attivala in Impostazioni per usarla e visualizzarla nel menu.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Car className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Spese Auto</h2>
          <p className="text-sm text-muted-foreground">Gestisci in modo separato assicurazione, benzina, gomme e manutenzione.</p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Riepilogo per singola auto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {perCarOverview.map(({ car, monthly, yearly }) => (
            <div key={car.id} className="rounded-xl border border-border/60 bg-background/40 px-3 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative w-9 h-9 rounded-full bg-muted/60 border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                  <Car className="w-4 h-4 text-muted-foreground" />
                  {car.logoUrl && (
                    <img
                      src={car.logoUrl}
                      alt={getCarDisplayName(car)}
                      className="absolute inset-0 w-full h-full object-cover bg-background"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{getCarDisplayName(car)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{[car.brand, car.model].filter(Boolean).join(' ')}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mese</span>
                  <span className="font-semibold text-emerald-500">{fmt(monthly)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Anno</span>
                  <span className="font-semibold text-emerald-500">{fmt(yearly)}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 min-[980px]:grid-cols-3 gap-3">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Questo mese</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-emerald-500">{fmt(monthlyTotal)}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Quest'anno</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-emerald-500">{fmt(yearlyTotal)}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Movimenti registrati</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{carExpenses.length}</p></CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Nuova Spesa Auto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Auto</Label>
              <Select value={form.car || configuredCars[0]?.id} onValueChange={(value) => setForm((current) => ({ ...current, car: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {configuredCars.map((car) => (
                    <SelectItem key={car.id} value={car.id}>{getCarDisplayName(car)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Sottocategoria</Label>
              <Select value={form.subcategory} onValueChange={(value) => setForm((current) => ({ ...current, subcategory: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAR_SUBCATEGORIES.map((subcategory) => (
                    <SelectItem key={subcategory.name} value={subcategory.name}>{subcategory.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Importo (€)</Label>
              <Input type="number" step="0.01" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Data</Label>
              <DatePicker required value={form.date} onChange={(date) => setForm((current) => ({ ...current, date }))} placeholder="Seleziona data" />
            </div>

            <div className="space-y-1">
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

            <div className="space-y-1 md:col-span-2">
              <Label>Note</Label>
              <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Es. Tagliando annuale" />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" className="gap-1">
                <Plus className="w-4 h-4" />
                Salva Spesa Auto
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Spesa per sottocategoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bySubcategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna spesa auto registrata.</p>
          ) : (
            bySubcategory.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span>{name}</span>
                <Badge variant="secondary">{fmt(value)}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Spesa per auto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {byCar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna spesa auto registrata.</p>
          ) : (
            byCar.map(([name, value]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span>{name}</span>
                <Badge variant="secondary">{fmt(value)}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Ultimi movimenti auto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {carExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun movimento auto presente.</p>
          ) : (
            carExpenses.slice(0, 20).map((expense) => {
              const category = categories.find((item) => item.id === expense.category_id);
              const account = accounts.find((item) => item.id === expense.account_id);
              return (
                <div key={expense.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{category?.name || 'Auto'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(parseISO(expense.date), 'dd MMM yyyy', { locale: it })}
                      {account?.name ? ` · ${account.name}` : ''}
                      {expense.notes ? ` · ${expense.notes}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-500">-{fmt(Number(expense.amount))}</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
