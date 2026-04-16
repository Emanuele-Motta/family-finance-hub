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
import { useToast } from '@/hooks/use-toast';
import { createTransaction } from '@/services/transactionService';

interface ParseResponse {
  ok: boolean;
  parsed?: {
    amount: number;
    type: 'income' | 'expense';
    notes: string | null;
    categoryName: string | null;
    confidence: number;
  };
  error?: string;
}

export default function ChatPage() {
  const categories = useCategories();
  const { accounts } = useAccounts();
  const { refetch } = useTransactions();
  const { currentFamilyGroupId } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();

  const defaultAccount = useMemo(() => accounts.find((a) => a.is_primary) || accounts[0], [accounts]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParseResponse['parsed'] | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('chat-parse', {
      body: { text, categories },
    });
    setLoading(false);

    if (error || !data?.ok) {
      toast({ title: 'Parsing fallito', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }

    setParsed((data as ParseResponse).parsed || null);
  };

  const handleConfirm = async () => {
    if (!parsed || !user || !currentFamilyGroupId || !defaultAccount) return;
    try {
      const cat = categories.find((c) => c.name.toLowerCase() === (parsed.categoryName || '').toLowerCase() && c.type === parsed.type);
      await createTransaction({
        familyGroupId: currentFamilyGroupId,
        userId: user.id,
        accountId: defaultAccount.id,
        amount: parsed.amount,
        type: parsed.type,
        date: new Date().toISOString().split('T')[0],
        categoryId: cat?.id ?? null,
        notes: parsed.notes,
      });
      await refetch();
      toast({ title: 'Transazione creata dalla chat' });
      setParsed(null);
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

          {parsed && (
            <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge variant={parsed.type === 'income' ? 'default' : 'destructive'}>
                  {parsed.type === 'income' ? 'Entrata' : 'Spesa'}
                </Badge>
                <Badge variant="outline">Confidenza {(parsed.confidence * 100).toFixed(0)}%</Badge>
              </div>
              <p className="text-sm">Importo: <strong>€{parsed.amount.toFixed(2)}</strong></p>
              <p className="text-sm">Categoria suggerita: <strong>{parsed.categoryName || 'Nessuna'}</strong></p>
              {parsed.notes && <p className="text-sm text-muted-foreground">Note: {parsed.notes}</p>}
              <Button onClick={handleConfirm}>Conferma e crea transazione</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
