// 16-Apr-2026 — Emanuele Motta
// Rules Management Page - Backend automation rules

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useFinanceData';
import { getTransactionRules, createTransactionRule, updateTransactionRule, deleteTransactionRule, evaluateRule, applyRuleActions } from '@/services/rulesService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import type { TransactionRule } from '@/types/finance';

export default function RulesPage() {
  const { currentFamilyGroupId } = useAppStore();
  const { user } = useAuth();
  const categories = useCategories();
  const { toast } = useToast();

  const [rules, setRules] = useState<TransactionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    enabled: true,
    priority: 0,
    conditionLogic: 'and' as 'and' | 'or',
    conditionKeywords: '',
    conditionMinAmount: '',
    conditionMaxAmount: '',
    conditionCategoryIds: [] as string[],
    conditionTypes: [] as ('income' | 'expense' | 'transfer')[],
    actionCategoryId: '',
    actionTags: '',
  });

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFamilyGroupId]);

  const loadRules = async () => {
    if (!currentFamilyGroupId) return;
    try {
      setLoading(true);
      const loaded = await getTransactionRules(currentFamilyGroupId);
      setRules(loaded);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Errore sconosciuto';
      toast({ title: 'Errore caricamento regole', description: error, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome richiesto', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        name: form.name,
        enabled: form.enabled,
        priority: Number(form.priority),
         conditionLogic: form.conditionLogic,
         conditions: {
          keywords: form.conditionKeywords ? form.conditionKeywords.split(',').map((k) => k.trim()) : undefined,
          minAmount: form.conditionMinAmount ? Number(form.conditionMinAmount) : undefined,
          maxAmount: form.conditionMaxAmount ? Number(form.conditionMaxAmount) : undefined,
          categoryIds: form.conditionCategoryIds.length > 0 ? form.conditionCategoryIds : undefined,
          types: form.conditionTypes.length > 0 ? form.conditionTypes : undefined,
        },
        actions: {
          setCategoryId: form.actionCategoryId || undefined,
          addTags: form.actionTags ? form.actionTags.split(',').map((t) => t.trim().toLowerCase()) : undefined,
        },
      };

      if (editingId) {
        const updated = await updateTransactionRule(editingId, payload);
        setRules((current) => current.map((r) => (r.id === editingId ? updated : r)));
        toast({ title: 'Regola aggiornata' });
      } else {
        const created = await createTransactionRule(currentFamilyGroupId, payload);
        setRules((current) => [...current, created].sort((a, b) => b.priority - a.priority));
        toast({ title: 'Regola creata' });
      }

      resetForm();
      setOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast({ title: 'Errore', description: msg, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Eliminare questa regola?');
    if (!confirmed) return;

    try {
      await deleteTransactionRule(id);
      setRules((current) => current.filter((r) => r.id !== id));
      toast({ title: 'Regola eliminata' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast({ title: 'Errore', description: msg, variant: 'destructive' });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const updated = await updateTransactionRule(id, { enabled });
      setRules((current) => current.map((r) => (r.id === id ? updated : r)));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast({ title: 'Errore', description: msg, variant: 'destructive' });
    }
  };

  const handlePriority = async (id: string, delta: number) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    const newPriority = Math.max(0, Math.min(1000, rule.priority + delta));
    try {
      const updated = await updateTransactionRule(id, { priority: newPriority });
      setRules((current) => [...current.map((r) => (r.id === id ? updated : r))].sort((a, b) => b.priority - a.priority));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast({ title: 'Errore', description: msg, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      enabled: true,
      priority: 0,
       conditionLogic: 'and' as 'and' | 'or',
      conditionKeywords: '',
      conditionMinAmount: '',
      conditionMaxAmount: '',
      conditionCategoryIds: [],
      conditionTypes: [],
      actionCategoryId: '',
      actionTags: '',
    });
    setEditingId(null);
  };

  const startEdit = (rule: TransactionRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
       conditionLogic: rule.conditionLogic || 'and',
      conditionKeywords: rule.conditions.keywords?.join(', ') || '',
      conditionMinAmount: rule.conditions.minAmount?.toString() || '',
      conditionMaxAmount: rule.conditions.maxAmount?.toString() || '',
      conditionCategoryIds: rule.conditions.categoryIds || [],
      conditionTypes: rule.conditions.types || [],
      actionCategoryId: rule.actions.setCategoryId || '',
      actionTags: rule.actions.addTags?.join(', ') || '',
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Regole di automazione</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuova regola
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica regola' : 'Nuova regola'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Nome regola *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Es: Cibo autodeterminato" />
              </div>

              <div className="space-y-2">
                <Label>Priorità (esecuzione ordinata)</Label>
                <Input type="number" min="0" max="1000" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Switch checked={form.enabled} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} />
                  Abilitata
                </Label>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-2">Condizioni (tutte devono combaciare)</p>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Parole chiave (virgola separato)</Label>
                    <Input value={form.conditionKeywords} onChange={(e) => setForm({ ...form, conditionKeywords: e.target.value })} placeholder="Es: supermercato, cibo" size={1} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Importo minimo</Label>
                      <Input type="number" step="0.01" value={form.conditionMinAmount} onChange={(e) => setForm({ ...form, conditionMinAmount: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Importo massimo</Label>
                      <Input type="number" step="0.01" value={form.conditionMaxAmount} onChange={(e) => setForm({ ...form, conditionMaxAmount: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Tipi movimento</Label>
                    <div className="flex gap-2">
                      {(['expense', 'income', 'transfer'] as const).map((type) => (
                        <label key={type} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.conditionTypes.includes(type)}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...form.conditionTypes, type]
                                : form.conditionTypes.filter((t) => t !== type);
                              setForm({ ...form, conditionTypes: newTypes });
                            }}
                          />
                          <span className="text-xs capitalize">{type === 'expense' ? 'Spesa' : type === 'income' ? 'Entrata' : 'Trasferimento'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

                           <div className="space-y-1">
                             <Label>Logica condizioni</Label>
                             <Select value={form.conditionLogic} onValueChange={(value) => setForm({ ...form, conditionLogic: value as 'and' | 'or' })}>
                               <SelectTrigger><SelectValue /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="and">Tutte devono combaciare (AND)</SelectItem>
                                 <SelectItem value="or">Almeno una deve combaciare (OR)</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-2">Azioni (da applicare quando la regola combacia)</p>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Imposta categoria</Label>
                    <Select value={form.actionCategoryId} onValueChange={(value) => setForm({ ...form, actionCategoryId: value })}>
                      <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                      <SelectContent>
                        {categories.filter((c) => c.type === 'expense').map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Aggiungi tag (virgola separati)</Label>
                    <Input value={form.actionTags} onChange={(e) => setForm({ ...form, actionTags: e.target.value })} placeholder="Es: auto, urgente" size={1} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
                <Button onClick={handleSave}>{editingId ? 'Aggiorna' : 'Crea regola'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Caricamento regole...</div>
      ) : rules.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-10 text-center text-muted-foreground">Nessuna regola. Crea la prima per automatizzare le transazioni.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id} className={`glass-card ${!rule.enabled ? 'opacity-50' : ''}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.enabled} onCheckedChange={(checked) => handleToggle(rule.id, checked)} />
                      <h3 className="font-semibold">{rule.name}</h3>
                      <Badge variant="outline" className="text-xs">Priorità: {rule.priority}</Badge>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      {rule.conditions.keywords && <p>Parole: {rule.conditions.keywords.join(', ')}</p>}
                      {rule.conditions.minAmount && <p>Min: €{rule.conditions.minAmount}</p>}
                      {rule.conditions.maxAmount && <p>Max: €{rule.conditions.maxAmount}</p>}
                       <p className="text-xs font-semibold">Logica: {rule.conditionLogic === 'and' ? 'Tutte devono combaciare (AND)' : 'Almeno una deve combaciare (OR)'}</p>
                      {rule.actions.setCategoryId && (
                        <p>Categoria: {categories.find((c) => c.id === rule.actions.setCategoryId)?.name || 'Sconosciuta'}</p>
                      )}
                      {rule.actions.addTags && <p>Tag da aggiungere: {rule.actions.addTags.join(', ')}</p>}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handlePriority(rule.id, 10)} title="Aumenta priorità">
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePriority(rule.id, -10)} title="Diminuisci priorità">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(rule)} title="Modifica">✏️</Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
