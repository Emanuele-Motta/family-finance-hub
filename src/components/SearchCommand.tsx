import { useState, useEffect, useMemo } from 'react';
import { useTransactions, useCategories } from '@/hooks/useFinanceData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { transactions } = useTransactions();
  const categories = useCategories();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return transactions.slice(0, 10);
    const q = query.toLowerCase();
    return transactions.filter(t => {
      const cat = categories.find(c => c.id === t.category_id);
      return (
        (cat?.name.toLowerCase().includes(q)) ||
        (t.notes?.toLowerCase().includes(q)) ||
        String(t.amount).includes(q) ||
        t.date.includes(q)
      );
    }).slice(0, 20);
  }, [query, transactions, categories]);

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Cerca...</span>
        <kbd className="hidden sm:inline text-[10px] bg-background px-1 py-0.5 rounded border border-border ml-2">⌘⇧F</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Cerca transazioni
            </DialogTitle>
          </DialogHeader>
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca per categoria, nota, importo..."
            autoFocus
            className="h-10"
          />
          <div className="overflow-y-auto max-h-[40vh] divide-y divide-border">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nessun risultato</p>
            ) : results.map(t => {
              const cat = categories.find(c => c.id === t.category_id);
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#888' }} />
                    <div>
                      <p className="text-sm">{cat?.name || 'Senza categoria'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(t.date), 'dd MMM yyyy', { locale: it })}
                        {t.notes && ` · ${t.notes}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
