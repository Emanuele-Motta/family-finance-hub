import { useMemo, useState } from 'react';
import { useCategories, useAccounts, useTransactions } from '@/hooks/useFinanceData';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createTransaction } from '@/services/transactionService';
import { useCarExpensesSettings, getCarDisplayName } from '@/hooks/useCarExpensesSettings';
import { parseISO } from 'date-fns';

interface ParseResponse {
  ok: boolean;
  parsed?: {
    amount: number;
    type: 'income' | 'expense';
    notes: string | null;
    categoryName: string | null;
    confidence: number;
    reason?: string;
  };
  error?: string;
}

const PREF_KEY = 'ff_chat_preferences_v1';

type ChatPrefs = {
  preferredAccountId?: string;
  preferredCategoryByType?: Record<'income' | 'expense', string>;
};

export default function ChatPage() {
  const categories = useCategories();
  const { accounts } = useAccounts();
  const { transactions, refetch } = useTransactions();
  const { currentFamilyGroupId } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: carSettings } = useCarExpensesSettings(currentFamilyGroupId);

  const [prefs, setPrefs] = useState<ChatPrefs>(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as ChatPrefs;
    } catch {
      return {};
    }
  });
  const defaultAccount = useMemo(() => {
    const preferred = accounts.find((account) => account.id === prefs.preferredAccountId);
    return preferred || accounts.find((account) => account.is_primary) || accounts[0];
  }, [accounts, prefs.preferredAccountId]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParseResponse['parsed'] | null>(null);
  const [editableAmount, setEditableAmount] = useState('');
  const [editableType, setEditableType] = useState<'income' | 'expense'>('expense');
  const [editableCategoryId, setEditableCategoryId] = useState('');
  const [editableNotes, setEditableNotes] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [reportAnswer, setReportAnswer] = useState<string | null>(null);

  const savePrefs = (next: ChatPrefs) => {
    setPrefs(next);
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  };

  const tryHandleReportQuery = () => {
    const q = text.trim().toLowerCase();
    if (!q.startsWith('quanto ho speso')) return false;

    const monthMap: Record<string, number> = {
      gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
      luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
    };

    let targetMonth: number | null = null;
    for (const [name, idx] of Object.entries(monthMap)) {
      if (q.includes(name)) {
        targetMonth = idx;
        break;
      }
    }

    const category = categories.find((c) => c.type === 'expense' && q.includes(c.name.toLowerCase()));
    const now = new Date();
    const monthFilter = targetMonth === null ? now.getMonth() : targetMonth;

    const total = transactions
      .filter((t) => t.type === 'expense')
      .filter((t) => {
        const d = parseISO(t.date);
        return d.getMonth() === monthFilter && d.getFullYear() === now.getFullYear();
      })
      .filter((t) => (category ? t.category_id === category.id : true))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const monthLabel = Object.keys(monthMap).find((k) => monthMap[k] === monthFilter) || 'questo mese';
    const catLabel = category ? ` in ${category.name}` : '';
    const amountText = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(total);
    setReportAnswer(`Hai speso ${amountText}${catLabel} a ${monthLabel}.`);
    setParsed(null);
    return true;
  };

  const handleParse = async () => {
    if (!text.trim()) return;
    setReportAnswer(null);
    if (tryHandleReportQuery()) return;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('chat-parse', {
      body: { text, categories },
    });
    setLoading(false);

    if (error || !data?.ok) {
      toast({ title: 'Parsing fallito', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }

    const parsedData = (data as ParseResponse).parsed || null;
    setParsed(parsedData);
    if (parsedData) {
      setEditableAmount(String(parsedData.amount));
      setEditableType(parsedData.type);
      const preferredCategory = prefs.preferredCategoryByType?.[parsedData.type] || '';
      const exactCategory = categories.find((c) => c.type === parsedData.type && c.name.toLowerCase() === (parsedData.categoryName || '').toLowerCase());
      setEditableCategoryId(exactCategory?.id || preferredCategory || '');
      setEditableNotes(parsedData.notes || '');
      setSelectedAccountId(defaultAccount?.id || '');
    }
  };

  const findMatchedCar = () => {
    const source = `${text} ${editableNotes}`.toLowerCase();
    return carSettings.cars.find((car) => {
      const display = getCarDisplayName(car).toLowerCase();
      const full = `${car.brand} ${car.model}`.trim().toLowerCase();
      return source.includes(display) || (full && source.includes(full)) || source.includes(car.brand.toLowerCase());
    }) || null;
  };

  const handleConfirm = async () => {
    if (!parsed || !user || !currentFamilyGroupId || !defaultAccount) return;
    try {
      const amount = Number(editableAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast({ title: 'Importo non valido', variant: 'destructive' });
        return;
      }

      const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || defaultAccount;
      const matchedCar = editableType === 'expense' ? findMatchedCar() : null;
      const carSlug = matchedCar ? getCarDisplayName(matchedCar).toLowerCase().replace(/\s+/g, '-') : null;

      const tags = matchedCar
        ? ['car-expense', `car-id:${matchedCar.id}`, `car:${carSlug}`]
        : null;

      await createTransaction({
        familyGroupId: currentFamilyGroupId,
        userId: user.id,
        accountId: selectedAccount.id,
        amount,
        type: editableType,
        date: new Date().toISOString().split('T')[0],
        categoryId: editableCategoryId || null,
        notes: editableNotes || null,
        tags,
      });

      savePrefs({
        preferredAccountId: selectedAccount.id,
        preferredCategoryByType: {
          income: editableType === 'income' ? (editableCategoryId || prefs.preferredCategoryByType?.income || '') : (prefs.preferredCategoryByType?.income || ''),
          expense: editableType === 'expense' ? (editableCategoryId || prefs.preferredCategoryByType?.expense || '') : (prefs.preferredCategoryByType?.expense || ''),
        },
      });

      await refetch();
      toast({ title: 'Transazione creata dalla chat' });
      setParsed(null);
      setEditableAmount('');
      setEditableCategoryId('');
      setEditableNotes('');
      setSelectedAccountId('');
      setText('');
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 max-w-2xl animate-fade-in">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Chat intelligente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descrivi la transazione</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Es. "Ho speso 42 euro al ristorante"'
              onKeyDown={(e) => e.key === 'Enter' && handleParse()}
            />
          </div>
          <Button onClick={handleParse} disabled={loading || !text.trim()}>
            {loading ? 'Analisi...' : 'Analizza'}
          </Button>

          {reportAnswer && (
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm">{reportAnswer}</p>
            </div>
          )}

          {parsed && (
            <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge variant={editableType === 'income' ? 'default' : 'destructive'}>
                  {editableType === 'income' ? 'Entrata' : 'Spesa'}
                </Badge>
                <Badge variant="outline">Confidenza {(parsed.confidence * 100).toFixed(0)}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{parsed.reason || 'Interpretazione base del testo.'}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Importo</Label>
                  <Input value={editableAmount} type="number" step="0.01" onChange={(e) => setEditableAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={editableType} onValueChange={(value: 'income' | 'expense') => setEditableType(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Spesa</SelectItem>
                      <SelectItem value="income">Entrata</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={editableCategoryId} onValueChange={setEditableCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => c.type === editableType).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Account</Label>
                  <Select value={selectedAccountId || defaultAccount?.id || ''} onValueChange={setSelectedAccountId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Note</Label>
                <Input value={editableNotes} onChange={(e) => setEditableNotes(e.target.value)} />
              </div>

              {findMatchedCar() && (
                <Badge variant="secondary">Auto rilevata: {getCarDisplayName(findMatchedCar()!)}</Badge>
              )}

              <Button onClick={handleConfirm}>Conferma e crea transazione</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
