import { useState, useEffect, useMemo } from 'react';
import { useTransactions, useCategories, useBudgets, useGoals, useDebts } from '@/hooks/useFinanceData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, Target, CreditCard, Wallet, BarChart3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ResultType = 'transaction' | 'budget' | 'goal' | 'debt';
type FilterType = 'all' | ResultType;

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  value?: string;
  valueColor?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  relevance: number;
}

const TYPE_CONFIG: Record<ResultType, { label: string; icon: React.ElementType; color: string }> = {
  transaction: { label: 'Transazione', icon: ArrowRight, color: 'text-primary' },
  budget:      { label: 'Budget',      icon: BarChart3,  color: 'text-blue-500' },
  goal:        { label: 'Obiettivo',   icon: Target,     color: 'text-amber-500' },
  debt:        { label: 'Debito',      icon: CreditCard, color: 'text-rose-500' },
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',         label: 'Tutti' },
  { key: 'transaction', label: 'Transazioni' },
  { key: 'budget',      label: 'Budget' },
  { key: 'goal',        label: 'Obiettivi' },
  { key: 'debt',        label: 'Debiti' },
];

export default function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const { transactions } = useTransactions();
  const categories = useCategories();
  const { budgets } = useBudgets();
  const { goals } = useGoals();
  const { debts } = useDebts();

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setFilter('all');
    }
  }, [open]);

  const scoreMatch = (text: string, q: string): number => {
    if (!text) return 0;
    const t = text.toLowerCase();
    if (t === q) return 10;
    if (t.startsWith(q)) return 7;
    if (t.includes(q)) return 4;
    return 0;
  };

  const results = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim();
    const all: SearchResult[] = [];

    // --- TRANSACTIONS ---
    if (filter === 'all' || filter === 'transaction') {
      const source = q ? transactions : transactions.slice(0, 5);
      for (const t of source) {
        const cat = categories.find(c => c.id === t.category_id);
        let relevance = 0;
        if (q) {
          relevance += scoreMatch(cat?.name || '', q);
          relevance += scoreMatch(t.notes || '', q);
          relevance += scoreMatch(String(t.amount), q);
          relevance += scoreMatch(t.date, q);
          if (relevance === 0) continue;
        } else {
          relevance = 1;
        }
        all.push({
          id: t.id,
          type: 'transaction',
          title: cat?.name || 'Senza categoria',
          subtitle: format(parseISO(t.date), 'dd MMM yyyy', { locale: it }) + (t.notes ? ` · ${t.notes}` : ''),
          value: `${t.type === 'income' ? '+' : '-'}${fmt(Number(t.amount))}`,
          valueColor: t.type === 'income' ? 'text-income' : 'text-expense',
          badge: t.type === 'income' ? 'Entrata' : t.type === 'expense' ? 'Spesa' : 'Trasf.',
          relevance,
        });
      }
    }

    // --- BUDGETS ---
    if (filter === 'all' || filter === 'budget') {
      for (const b of budgets) {
        const cat = categories.find(c => c.id === b.category_id);
        const name = cat?.name || 'Budget senza categoria';
        let relevance = 0;
        if (q) {
          relevance = scoreMatch(name, q) + scoreMatch(String(b.amount), q);
          if (relevance === 0) continue;
        } else {
          relevance = 1;
        }
        all.push({
          id: b.id,
          type: 'budget',
          title: name,
          subtitle: `Limite ${b.period === 'monthly' ? 'mensile' : 'annuale'}`,
          value: fmt(Number(b.amount)),
          valueColor: 'text-blue-600',
          relevance,
        });
      }
    }

    // --- GOALS ---
    if (filter === 'all' || filter === 'goal') {
      for (const g of goals) {
        let relevance = 0;
        if (q) {
          relevance = scoreMatch(g.name, q) + scoreMatch(String(g.target_amount), q);
          if (relevance === 0) continue;
        } else {
          relevance = 1;
        }
        const pct = g.target_amount > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0;
        all.push({
          id: g.id,
          type: 'goal',
          title: g.name,
          subtitle: `${fmt(Number(g.current_amount))} di ${fmt(Number(g.target_amount))} · ${pct}%`,
          value: `${pct}%`,
          valueColor: pct >= 100 ? 'text-income' : 'text-amber-600',
          badge: pct >= 100 ? 'Completato' : 'In corso',
          badgeVariant: pct >= 100 ? 'default' : 'secondary',
          relevance,
        });
      }
    }

    // --- DEBTS ---
    if (filter === 'all' || filter === 'debt') {
      for (const d of debts) {
        let relevance = 0;
        if (q) {
          relevance = scoreMatch(d.name, q) + scoreMatch(String(d.remaining_amount), q);
          if (relevance === 0) continue;
        } else {
          relevance = 1;
        }
        all.push({
          id: d.id,
          type: 'debt',
          title: d.name,
          subtitle: d.is_paid ? 'Saldato' : `Residuo: ${fmt(Number(d.remaining_amount))}`,
          value: fmt(Number(d.remaining_amount)),
          valueColor: d.is_paid ? 'text-income' : 'text-expense',
          badge: d.is_paid ? 'Saldato' : 'Aperto',
          badgeVariant: d.is_paid ? 'secondary' : 'destructive',
          relevance,
        });
      }
    }

    // Sort: by relevance desc, then by type priority
    const typePriority: Record<ResultType, number> = { transaction: 0, budget: 1, goal: 2, debt: 3 };
    return all
      .sort((a, b) => b.relevance - a.relevance || typePriority[a.type] - typePriority[b.type])
      .slice(0, 25);
  }, [query, filter, transactions, categories, budgets, goals, debts]);

  // Group by type for hierarchical display
  const grouped = useMemo(() => {
    const groups: Partial<Record<ResultType, SearchResult[]>> = {};
    for (const r of results) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type]!.push(r);
    }
    return groups;
  }, [results]);

  const totalCount = results.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Cerca...</span>
        <kbd className="hidden sm:inline text-[10px] bg-background px-1 py-0.5 rounded border border-border ml-2">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="sr-only">Ricerca globale</DialogTitle>
          </DialogHeader>

          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cerca transazioni, budget, obiettivi, debiti..."
              autoFocus
              className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-base placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto scrollbar-none">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors',
                  filter === f.key
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {totalCount === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                {query ? `Nessun risultato per "${query}"` : 'Inizia a digitare per cercare'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(Object.keys(grouped) as ResultType[]).map(type => {
                  const group = grouped[type]!;
                  const { label, icon: Icon, color } = TYPE_CONFIG[type];
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 sticky top-0 z-10">
                        <Icon className={cn('w-3.5 h-3.5', color)} />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{group.length}</span>
                      </div>
                      {group.map((result, i) => (
                        <div
                          key={result.id}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer animate-fade-in-up"
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', color.replace('text-', 'bg-'))} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{result.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            {result.badge && (
                              <Badge variant={result.badgeVariant || 'secondary'} className="text-[10px] h-4 px-1.5">
                                {result.badge}
                              </Badge>
                            )}
                            {result.value && (
                              <span className={cn('text-sm font-semibold tabular-nums', result.valueColor)}>
                                {result.value}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-muted/20">
            <span className="text-xs text-muted-foreground">{totalCount} risultati</span>
            <kbd className="text-[10px] text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded">Esc per chiudere</kbd>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
