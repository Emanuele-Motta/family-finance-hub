import { useState, useEffect, useRef } from 'react';
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import type { Category } from '@/types/finance';
import { parseTransaction } from '@/lib/transactionParser';
import { parseAndCreate } from '@/services/transactionService';

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addTransaction, refetch } = useTransactions();
  const categories = useCategories();
  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();

  const parsed = parseTransaction(input, categories);
  const defaultAccount = accounts.find(a => a.is_primary) || accounts[0];

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === '+' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Load recent categories from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('ff_recent_categories');
    if (stored) setRecentCategories(JSON.parse(stored));
  }, []);

  const saveRecentCategory = (catId: string) => {
    const updated = [catId, ...recentCategories.filter(id => id !== catId)].slice(0, 5);
    setRecentCategories(updated);
    localStorage.setItem('ff_recent_categories', JSON.stringify(updated));
  };

  const handleSubmit = async () => {
    if (!parsed || !user || !currentFamilyGroupId || !defaultAccount) return;
    try {
      const result = await parseAndCreate({
        text: input,
        categories,
        familyGroupId: currentFamilyGroupId,
        userId: user.id,
        accountId: defaultAccount.id,
      });
      await refetch();
      if (result.categoryId) saveRecentCategory(result.categoryId);
      toast.success('Transazione aggiunta!');
      setInput('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleQuickCategory = async (cat: Category) => {
    if (!parsed?.amount || !user || !currentFamilyGroupId || !defaultAccount) return;
    try {
      await addTransaction({
        family_group_id: currentFamilyGroupId,
        user_id: user.id,
        created_by_user_id: user.id,
        paid_by_user_id: user.id,
        category_id: cat.id,
        account_id: defaultAccount.id,
        to_account_id: null,
        amount: parsed.amount,
        type: cat.type,
        date: new Date().toISOString().split('T')[0],
        notes: parsed.notes,
        recurring: false,
        recurrence_type: null,
        tags: null,
      });
      saveRecentCategory(cat.id);
      toast.success(`${cat.type === 'income' ? '+' : '-'}€${parsed.amount} ${cat.name}`);
      setInput('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const suggestedCategories = parsed?.amount
    ? (recentCategories
        .map(id => categories.find(c => c.id === id))
        .filter((c): c is Category => !!c && c.type === (parsed?.type || 'expense'))
        .slice(0, 4))
    : [];

  return (
    <>
      {/* FAB */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all hover:scale-105"
        size="icon"
      >
        <Plus className="w-6 h-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Inserimento rapido
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && parsed && handleSubmit()}
                placeholder='Es. "50 cibo" o "+1500 stipendio"'
                className="h-12 text-lg pr-12"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </div>

            {/* Live preview */}
            {parsed && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {parsed.type === 'income' ? (
                    <ArrowUp className="w-4 h-4 text-income" />
                  ) : (
                    <ArrowDown className="w-4 h-4 text-expense" />
                  )}
                  <span className={`font-bold text-lg ${parsed.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {parsed.type === 'income' ? '+' : '-'}€{parsed.amount.toFixed(2)}
                  </span>
                  <Badge variant={parsed.type === 'income' ? 'default' : 'destructive'} className="text-xs">
                    {parsed.type === 'income' ? 'Entrata' : 'Spesa'}
                  </Badge>
                </div>
                {parsed.categoryId && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categories.find(c => c.id === parsed.categoryId)?.color || '#888' }} />
                    {parsed.categoryName}
                  </div>
                )}
                {parsed.notes && <p className="text-xs text-muted-foreground">{parsed.notes}</p>}
              </div>
            )}

            {/* Suggested categories */}
            {parsed?.amount && suggestedCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Categorie recenti:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedCategories.map(cat => (
                    <Button
                      key={cat.id}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleQuickCategory(cat)}
                    >
                      <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* All categories for type */}
            {parsed?.amount && !parsed.categoryId && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Categorie {parsed.type === 'income' ? 'entrate' : 'spese'}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories
                    .filter(c => c.type === parsed.type)
                    .map(cat => (
                      <Button
                        key={cat.id}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleQuickCategory(cat)}
                      >
                        <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </Button>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!parsed}
              >
                Aggiungi
              </Button>
              <Button variant="outline" onClick={() => { handleSubmit(); setInput(''); }}>
                Aggiungi e ripeti
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Digita importo + parole chiave. Premi Invio per confermare.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
