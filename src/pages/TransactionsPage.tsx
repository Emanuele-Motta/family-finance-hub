import { useMemo, useRef, useState } from 'react';
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFinanceData';
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Filter, Repeat, CalendarRange, Search, X, Copy, Download, Save, AlertTriangle, Pencil, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import CsvImport from '@/components/CsvImport';
import DatePicker from '@/components/DatePicker';
import { TransactionListSkeleton } from '@/components/ui/skeleton-layouts';
import { createRecurringTemplate } from '@/services/recurringService';
import { format, parseISO, startOfDay, endOfDay, subDays, subMonths, startOfMonth, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { ToastAction } from '@/components/ui/toast';
import type { Transaction } from '@/types/finance';
import { Checkbox } from '@/components/ui/checkbox';
import { createTrackedRefund } from '@/services/refundService';

const SAVED_VIEWS_KEY = 'ff_transactions_saved_views_v1';
const AUTO_RULES_KEY = 'ff_transactions_auto_rules_v1';
const AUDIT_KEY = 'ff_transactions_audit_v1';

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'last30' | 'quarter' | 'custom';

type SortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'category-asc';

type SavedView = {
  id: string;
  name: string;
  filterType: string;
  filterCategory: string;
  filterAccount: string;
  filterRecurring: string;
  datePreset: DatePreset;
  customDateFrom: string;
  customDateTo: string;
  sortMode: SortMode;
  searchQuery: string;
};

type AutoRule = {
  id: string;
  keyword: string;
  categoryId: string;
};

type AuditEntry = {
  id: string;
  at: string;
  action: string;
  summary: string;
};

type InlineEditForm = {
  amount: string;
  date: string;
  category_id: string;
  notes: string;
  tagsInput: string;
};

function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

export default function TransactionsPage() {
  const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const categories = useCategories();
  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterRecurring, setFilterRecurring] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [showDetectedOnly, setShowDetectedOnly] = useState(false);
  const [viewName, setViewName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkTagsInput, setBulkTagsInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<InlineEditForm | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleCategoryId, setNewRuleCategoryId] = useState('');
  const touchStartX = useRef<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [autoRules, setAutoRules] = useState<AutoRule[]>(() => {
    try {
      const raw = localStorage.getItem(AUTO_RULES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>(() => {
    try {
      const raw = localStorage.getItem(AUDIT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [form, setForm] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    category_id: '',
    account_id: '',
    to_account_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    recurring: false,
    recurrence_type: 'monthly' as 'monthly' | 'yearly',
    tagsInput: '',
  });

  const allAvailableTags = useMemo(
    () => Array.from(new Set(transactions.flatMap((transaction) => transaction.tags || []))).sort((a, b) => a.localeCompare(b)),
    [transactions],
  );

  const recurringCandidates = useMemo(() => {
    const ninetyDaysAgo = subDays(new Date(), 90);
    const groups = new Map<string, Transaction[]>();

    transactions.forEach((transaction) => {
      if (transaction.type !== 'expense') return;
      const txDate = parseISO(transaction.date);
      if (txDate < ninetyDaysAgo) return;
      const noteKey = (transaction.notes || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!noteKey) return;

      const key = `${noteKey}::${Number(transaction.amount).toFixed(2)}`;
      const current = groups.get(key) || [];
      current.push(transaction);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .map(([key, items]) => {
        const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length < 3) return null;

        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const prev = parseISO(sorted[i - 1].date).getTime();
          const curr = parseISO(sorted[i].date).getTime();
          intervals.push(Math.round((curr - prev) / (1000 * 60 * 60 * 24)));
        }
        const avgInterval = intervals.reduce((sum, value) => sum + value, 0) / Math.max(intervals.length, 1);
        const monthlyLike = avgInterval >= 24 && avgInterval <= 36;
        if (!monthlyLike) return null;

        const [normalizedNote, amount] = key.split('::');
        return {
          id: key,
          note: normalizedNote,
          amount: Number(amount),
          count: sorted.length,
          avgInterval,
          transactionIds: sorted.map((transaction) => transaction.id),
          alreadyRecurring: sorted.every((transaction) => transaction.recurring),
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [transactions]);

  const logAudit = (action: string, summary: string) => {
    const next: AuditEntry[] = [
      { id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), action, summary },
      ...auditEntries,
    ].slice(0, 60);
    setAuditEntries(next);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  };

  const saveRules = (next: AutoRule[]) => {
    setAutoRules(next);
    localStorage.setItem(AUTO_RULES_KEY, JSON.stringify(next));
  };

  const addAutoRule = () => {
    const keyword = newRuleKeyword.trim().toLowerCase();
    if (!keyword || !newRuleCategoryId) {
      toast({ title: 'Regola incompleta', variant: 'destructive' });
      return;
    }
    const existing = autoRules.find((rule) => rule.keyword === keyword);
    const next = existing
      ? autoRules.map((rule) => (rule.id === existing.id ? { ...rule, categoryId: newRuleCategoryId } : rule))
      : [{ id: `${Date.now()}`, keyword, categoryId: newRuleCategoryId }, ...autoRules].slice(0, 20);
    saveRules(next);
    setNewRuleKeyword('');
    setNewRuleCategoryId('');
    toast({ title: 'Regola salvata' });
  };

  const removeAutoRule = (id: string) => {
    saveRules(autoRules.filter((rule) => rule.id !== id));
  };

  const resetForm = () => {
    setForm({
      amount: '',
      type: 'expense',
      category_id: '',
      account_id: '',
      to_account_id: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      recurring: false,
      recurrence_type: 'monthly',
      tagsInput: '',
    });
  };

  const openSubscriptionDialog = () => {
    setForm({
      amount: '',
      type: 'expense',
      category_id: '',
      account_id: '',
      to_account_id: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      recurring: true,
      recurrence_type: 'monthly',
      tagsInput: '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const preferredAccountId = localStorage.getItem('ff_default_account_id') || '';
    const defaultAccountId = form.account_id || preferredAccountId || accounts.find(a => a.is_primary)?.id || accounts[0]?.id;
    if (!user || !currentFamilyGroupId || !defaultAccountId) return;

    const amount = parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: 'Importo non valido', description: 'Inserisci un importo maggiore di zero.', variant: 'destructive' });
      return;
    }

    try {
      let categoryId = form.type === 'transfer' ? null : form.category_id || null;
      const notes = form.notes.trim();
      if (form.type !== 'transfer' && !categoryId && notes) {
        const matchedRule = autoRules.find((rule) => notes.toLowerCase().includes(rule.keyword));
        if (matchedRule) {
          categoryId = matchedRule.categoryId;
          const matchedCategory = categories.find((category) => category.id === matchedRule.categoryId)?.name || 'categoria';
          toast({ title: 'Regola automatica applicata', description: `Categoria impostata: ${matchedCategory}` });
        }
      }

      const manualTags = parseTags(form.tagsInput);
      const tags = Array.from(new Set([...(form.recurring ? ['subscription'] : []), ...manualTags]));

      await addTransaction({
        family_group_id: currentFamilyGroupId,
        user_id: user.id,
        created_by_user_id: user.id,
        paid_by_user_id: user.id,
        category_id: categoryId,
        account_id: defaultAccountId,
        to_account_id: form.type === 'transfer' ? form.to_account_id || null : null,
        amount,
        type: form.type,
        date: form.date,
        notes: form.notes || null,
        recurring: form.recurring,
        recurrence_type: form.recurring ? form.recurrence_type : null,
        tags: tags.length > 0 ? tags : null,
      });

      if (form.recurring && form.type !== 'transfer') {
        const dayOfMonth = Math.min(31, Math.max(1, Number(form.date.split('-')[2] || '1')));
        const recurringName = form.notes.trim() || categories.find((category) => category.id === form.category_id)?.name || 'Spesa fissa';

        await createRecurringTemplate({
          family_group_id: currentFamilyGroupId,
          name: recurringName,
          description: form.notes.trim() || recurringName,
          frequency: form.recurrence_type,
          interval: 1,
          day_of_month: dayOfMonth,
          day_of_week: null,
          months: null,
          category_id: form.category_id || null,
          account_id: defaultAccountId,
          to_account_id: null,
          amount,
          type: form.type,
          tags: ['subscription'],
          starts_at: form.date,
          ends_at: null,
          max_occurrences: null,
          notify_days_before: 3,
          notify_method: 'all',
          is_active: true,
          created_by: user.id,
        });
      }

      toast({ title: form.recurring ? 'Spesa fissa aggiunta!' : 'Transazione aggiunta!' });
      logAudit('create', `${form.type} ${amount.toFixed(2)} in data ${form.date}`);
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const removed = transactions.find((transaction) => transaction.id === id);
    if (!removed) return;

    try {
      await deleteTransaction(id);
      toast({
        title: 'Transazione eliminata',
        action: (
          <ToastAction
            altText="Annulla eliminazione"
            onClick={async () => {
              try {
                await addTransaction({
                  family_group_id: removed.family_group_id,
                  user_id: removed.user_id,
                  created_by_user_id: removed.created_by_user_id,
                  paid_by_user_id: removed.paid_by_user_id,
                  category_id: removed.category_id,
                  account_id: removed.account_id,
                  to_account_id: removed.to_account_id,
                  amount: Number(removed.amount),
                  type: removed.type,
                  date: removed.date,
                  notes: removed.notes,
                  recurring: removed.recurring,
                  recurrence_type: removed.recurrence_type,
                  tags: removed.tags,
                });
                toast({ title: 'Eliminazione annullata' });
                logAudit('restore', `ripristinata transazione ${removed.type} ${Number(removed.amount).toFixed(2)}`);
              } catch (error: any) {
                toast({ title: 'Errore', description: error.message, variant: 'destructive' });
              }
            }}
          >
            Annulla
          </ToastAction>
        ),
      });
      logAudit('delete', `eliminata transazione ${removed.type} ${Number(removed.amount).toFixed(2)}`);
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const duplicateTransaction = async (transaction: Transaction) => {
    if (!user || !currentFamilyGroupId) return;
    try {
      await addTransaction({
        family_group_id: currentFamilyGroupId,
        user_id: user.id,
        created_by_user_id: user.id,
        paid_by_user_id: user.id,
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        to_account_id: transaction.to_account_id,
        amount: Number(transaction.amount),
        type: transaction.type,
        date: new Date().toISOString().split('T')[0],
        notes: transaction.notes,
        recurring: transaction.recurring,
        recurrence_type: transaction.recurrence_type,
        tags: transaction.tags,
      });
      toast({ title: 'Transazione duplicata' });
      logAudit('duplicate', `duplicata transazione ${transaction.type} ${Number(transaction.amount).toFixed(2)}`);
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleTrackedRefund = async (transaction: Transaction) => {
    if (!user) return;
    const reason = window.prompt('Motivo rimborso (opzionale):', transaction.notes || '');
    try {
      await createTrackedRefund({ originalExpense: transaction, userId: user.id, reason: reason || undefined });
      toast({ title: 'Rimborso registrato', description: 'Movimento di rimborso creato e tracciato.' });
      logAudit('refund', `rimborso tracciato per spesa ${Number(transaction.amount).toFixed(2)}`);
    } catch (error: any) {
      toast({ title: 'Errore rimborso', description: error.message, variant: 'destructive' });
    }
  };

  const handleSwipeStart = (clientX: number) => {
    touchStartX.current = clientX;
  };

  const handleSwipeEnd = (transactionId: string, clientX: number) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - clientX;
    if (delta > 45) {
      setSwipedId(transactionId);
    } else if (delta < -35) {
      setSwipedId(null);
    }
    touchStartX.current = null;
  };

  const saveViewsToStorage = (views: SavedView[]) => {
    setSavedViews(views);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTagFilters((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const markCandidateAsRecurring = async (candidateId: string, checked: boolean) => {
    const candidate = recurringCandidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    try {
      for (const transactionId of candidate.transactionIds) {
        await updateTransaction(transactionId, { recurring: checked, recurrence_type: checked ? 'monthly' : null });
      }
      toast({ title: checked ? 'Marcate come ricorrenti' : 'Rimosso stato ricorrente', description: `${candidate.count} transazioni aggiornate.` });
      logAudit('recurring-detection', `${checked ? 'attivato' : 'disattivato'} ricorrente per ${candidate.count} transazioni`);
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const saveCurrentView = () => {
    const normalized = viewName.trim();
    if (!normalized) {
      toast({ title: 'Nome vista mancante', variant: 'destructive' });
      return;
    }

    const nextView: SavedView = {
      id: `${Date.now()}`,
      name: normalized,
      filterType,
      filterCategory,
      filterAccount,
      filterRecurring,
      datePreset,
      customDateFrom,
      customDateTo,
      sortMode,
      searchQuery,
    };

    const existing = savedViews.find((view) => view.name.toLowerCase() === normalized.toLowerCase());
    const next = existing
      ? savedViews.map((view) => view.id === existing.id ? { ...nextView, id: existing.id } : view)
      : [nextView, ...savedViews].slice(0, 10);

    saveViewsToStorage(next);
    setViewName('');
    toast({ title: 'Vista filtri salvata' });
  };

  const applySavedView = (id: string) => {
    const selected = savedViews.find((view) => view.id === id);
    if (!selected) return;
    setFilterType(selected.filterType);
    setFilterCategory(selected.filterCategory);
    setFilterAccount(selected.filterAccount);
    setFilterRecurring(selected.filterRecurring);
    setDatePreset(selected.datePreset);
    setCustomDateFrom(selected.customDateFrom);
    setCustomDateTo(selected.customDateTo);
    setSortMode(selected.sortMode);
    setSearchQuery(selected.searchQuery);
  };

  const deleteSavedView = (id: string) => {
    const next = savedViews.filter((view) => view.id !== id);
    saveViewsToStorage(next);
  };

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filtered.map((transaction) => transaction.id)));
    else setSelectedIds(new Set());
  };

  const applyBulkCategory = async () => {
    if (!bulkCategoryId || selectedIds.size === 0) return;
    try {
      const selected = transactions.filter((transaction) => selectedIds.has(transaction.id) && transaction.type !== 'transfer');
      for (const transaction of selected) {
        await updateTransaction(transaction.id, { category_id: bulkCategoryId });
      }
      toast({ title: 'Categoria aggiornata', description: `Aggiornate ${selected.length} transazioni.` });
      logAudit('bulk-category', `aggiornate ${selected.length} transazioni`);
      setSelectedIds(new Set());
      setBulkCategoryId('');
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const applyBulkTags = async () => {
    const tagsToAdd = parseTags(bulkTagsInput);
    if (tagsToAdd.length === 0 || selectedIds.size === 0) return;
    try {
      const selected = transactions.filter((transaction) => selectedIds.has(transaction.id));
      for (const transaction of selected) {
        const merged = Array.from(new Set([...(transaction.tags || []), ...tagsToAdd]));
        await updateTransaction(transaction.id, { tags: merged });
      }
      toast({ title: 'Tag applicati', description: `Aggiornate ${selected.length} transazioni.` });
      logAudit('bulk-tags', `applicati tag a ${selected.length} transazioni`);
      setSelectedIds(new Set());
      setBulkTagsInput('');
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Eliminare ${selectedIds.size} transazioni selezionate?`);
    if (!confirmed) return;
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await deleteTransaction(id);
      }
      toast({ title: 'Transazioni eliminate', description: `${ids.length} elementi rimossi.` });
      logAudit('bulk-delete', `eliminate ${ids.length} transazioni`);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const startInlineEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditingForm({
      amount: String(Number(transaction.amount)),
      date: transaction.date,
      category_id: transaction.category_id || '',
      notes: transaction.notes || '',
      tagsInput: (transaction.tags || []).join(', '),
    });
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditingForm(null);
  };

  const saveInlineEdit = async (transaction: Transaction) => {
    if (!editingForm) return;
    const amount = Number(editingForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Importo non valido', variant: 'destructive' });
      return;
    }

    try {
      await updateTransaction(transaction.id, {
        amount,
        date: editingForm.date,
        category_id: transaction.type === 'transfer' ? transaction.category_id : (editingForm.category_id || null),
        notes: editingForm.notes.trim() || null,
        tags: parseTags(editingForm.tagsInput),
      });
      toast({ title: 'Transazione aggiornata' });
      logAudit('edit', `modificata transazione ${transaction.type} ${amount.toFixed(2)}`);
      cancelInlineEdit();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const now = new Date();
    const detectedIds = new Set(recurringCandidates.flatMap((candidate) => candidate.transactionIds));

    return transactions
      .filter((transaction) => {
        if (filterType !== 'all' && transaction.type !== filterType) return false;
        if (filterCategory !== 'all' && transaction.category_id !== filterCategory) return false;
        if (filterAccount !== 'all' && transaction.account_id !== filterAccount) return false;
        if (filterRecurring === 'recurring' && !transaction.recurring) return false;
        if (filterRecurring === 'oneoff' && transaction.recurring) return false;
        if (showDetectedOnly && !detectedIds.has(transaction.id)) return false;
        if (selectedTagFilters.length > 0) {
          const txTags = transaction.tags || [];
          if (!selectedTagFilters.every((tag) => txTags.includes(tag))) return false;
        }

        const txDate = parseISO(transaction.date);
        if (datePreset === 'today' && !isWithinInterval(txDate, { start: startOfDay(now), end: endOfDay(now) })) return false;
        if (datePreset === 'week' && !isWithinInterval(txDate, { start: startOfDay(subDays(now, 6)), end: endOfDay(now) })) return false;
        if (datePreset === 'month' && !isWithinInterval(txDate, { start: startOfMonth(now), end: endOfDay(now) })) return false;
        if (datePreset === 'last30' && !isWithinInterval(txDate, { start: startOfDay(subDays(now, 29)), end: endOfDay(now) })) return false;
        if (datePreset === 'quarter' && !isWithinInterval(txDate, { start: startOfDay(subMonths(now, 3)), end: endOfDay(now) })) return false;
        if (datePreset === 'custom' && customDateFrom && customDateTo) {
          if (!isWithinInterval(txDate, { start: startOfDay(parseISO(customDateFrom)), end: endOfDay(parseISO(customDateTo)) })) return false;
        }

        if (tokens.length === 0) return true;

        const categoryName = categories.find((category) => category.id === transaction.category_id)?.name || '';
        const accountName = accounts.find((account) => account.id === transaction.account_id)?.name || '';
        const toAccountName = accounts.find((account) => account.id === transaction.to_account_id)?.name || '';
        const notes = transaction.notes || '';
        const tags = (transaction.tags || []).join(' ');
        const haystack = [
          categoryName,
          accountName,
          toAccountName,
          notes,
          transaction.date,
          String(transaction.amount),
          transaction.type,
          tags,
        ].join(' ').toLowerCase();

        return tokens.every((token) => haystack.includes(token));
      })
      .slice()
      .sort((a, b) => {
        if (sortMode === 'date-desc') return b.date.localeCompare(a.date);
        if (sortMode === 'date-asc') return a.date.localeCompare(b.date);
        if (sortMode === 'amount-desc') return Number(b.amount) - Number(a.amount);
        if (sortMode === 'amount-asc') return Number(a.amount) - Number(b.amount);
        if (sortMode === 'category-asc') {
          const catA = categories.find((category) => category.id === a.category_id)?.name || '';
          const catB = categories.find((category) => category.id === b.category_id)?.name || '';
          return catA.localeCompare(catB);
        }
        return 0;
      });
  }, [transactions, filterType, filterCategory, filterAccount, filterRecurring, datePreset, customDateFrom, customDateTo, sortMode, searchQuery, categories, accounts, selectedTagFilters, showDetectedOnly, recurringCandidates]);

  const filteredStats = useMemo(() => {
    const income = filtered.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const expense = filtered.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const transfers = filtered.filter((transaction) => transaction.type === 'transfer').length;
    return {
      count: filtered.length,
      income,
      expense,
      net: income - expense,
      transfers,
    };
  }, [filtered]);

  const averageExpenseAmount = useMemo(() => {
    const expenses = filtered.filter((transaction) => transaction.type === 'expense').map((transaction) => Number(transaction.amount));
    if (expenses.length === 0) return 0;
    return expenses.reduce((sum, value) => sum + value, 0) / expenses.length;
  }, [filtered]);

  const exportFilteredCsv = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nessun dato da esportare' });
      return;
    }

    const headers = ['Data', 'Tipo', 'Categoria', 'Account', 'Account destinazione', 'Importo', 'Ricorrente', 'Note'];
    const lines = filtered.map((transaction) => {
      const categoryName = categories.find((category) => category.id === transaction.category_id)?.name || '';
      const accountName = accounts.find((account) => account.id === transaction.account_id)?.name || '';
      const toAccountName = accounts.find((account) => account.id === transaction.to_account_id)?.name || '';
      const cells = [
        transaction.date,
        transaction.type,
        categoryName,
        accountName,
        toAccountName,
        String(Number(transaction.amount).toFixed(2)),
        transaction.recurring ? 'si' : 'no',
        transaction.notes || '',
      ];
      return cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `transazioni_filtrate_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportSelectedCsv = () => {
    const selected = filtered.filter((transaction) => selectedIds.has(transaction.id));
    if (selected.length === 0) {
      toast({ title: 'Nessuna transazione selezionata' });
      return;
    }

    const headers = ['Data', 'Tipo', 'Categoria', 'Account', 'Importo', 'Tag', 'Note'];
    const lines = selected.map((transaction) => {
      const categoryName = categories.find((category) => category.id === transaction.category_id)?.name || '';
      const accountName = accounts.find((account) => account.id === transaction.account_id)?.name || '';
      const cells = [
        transaction.date,
        transaction.type,
        categoryName,
        accountName,
        String(Number(transaction.amount).toFixed(2)),
        (transaction.tags || []).join(';'),
        transaction.notes || '',
      ];
      return cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `transazioni_selezionate_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterCategory('all');
    setFilterAccount('all');
    setFilterRecurring('all');
    setDatePreset('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setSortMode('date-desc');
    setSearchQuery('');
    setSelectedTagFilters([]);
    setShowDetectedOnly(false);
  };

  const hasActiveFilters =
    filterType !== 'all' ||
    filterCategory !== 'all' ||
    filterAccount !== 'all' ||
    filterRecurring !== 'all' ||
    datePreset !== 'all' ||
    searchQuery.trim().length > 0 ||
    selectedTagFilters.length > 0 ||
    showDetectedOnly;

  const activeFilterCount = [
    filterType !== 'all',
    filterCategory !== 'all',
    filterAccount !== 'all',
    filterRecurring !== 'all',
    datePreset !== 'all',
    sortMode !== 'date-desc',
    selectedTagFilters.length > 0,
    showDetectedOnly,
  ].filter(Boolean).length;

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const allFilteredSelected = filtered.length > 0 && filtered.every((transaction) => selectedIds.has(transaction.id));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-3">
        {/* Stats bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Card className="glass-card"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Movimenti</p><p className="text-lg font-semibold">{filteredStats.count}</p></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Entrate</p><p className="text-lg font-semibold text-income">{fmt(filteredStats.income)}</p></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Spese</p><p className="text-lg font-semibold text-expense">{fmt(filteredStats.expense)}</p></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Netto</p><p className={`text-lg font-semibold ${filteredStats.net >= 0 ? 'text-primary' : 'text-orange-500'}`}>{fmt(filteredStats.net)}</p></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Trasferimenti</p><p className="text-lg font-semibold text-primary">{filteredStats.transfers}</p></CardContent></Card>
        </div>

        {/* Search + filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ricerca full-text (descrizione, tag, categoria, account, importo...)"
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant={filtersOpen || hasActiveFilters ? 'default' : 'outline'}
            className="shrink-0 gap-1.5"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtri</span>
            {activeFilterCount > 0 && (
              <span className="bg-white/20 text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">{activeFilterCount}</span>
            )}
            {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button
            type="button"
            variant={hasActiveFilters ? 'default' : 'outline'}
            className="shrink-0"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            <X className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>

        {/* Collapsible advanced filters */}
        {filtersOpen && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    <SelectItem value="income">Entrate</SelectItem>
                    <SelectItem value="expense">Spese</SelectItem>
                    <SelectItem value="transfer">Trasferimenti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={datePreset} onValueChange={(value: DatePreset) => setDatePreset(value)}>
                <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le date</SelectItem>
                  <SelectItem value="today">Oggi</SelectItem>
                  <SelectItem value="week">Ultimi 7 giorni</SelectItem>
                  <SelectItem value="last30">Ultimi 30 giorni</SelectItem>
                  <SelectItem value="month">Questo mese</SelectItem>
                  <SelectItem value="quarter">Ultimi 3 mesi</SelectItem>
                  <SelectItem value="custom">Intervallo custom</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortMode} onValueChange={(value: SortMode) => setSortMode(value)}>
                <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Data (più recenti)</SelectItem>
                  <SelectItem value="date-asc">Data (più vecchie)</SelectItem>
                  <SelectItem value="amount-desc">Importo (decrescente)</SelectItem>
                  <SelectItem value="amount-asc">Importo (crescente)</SelectItem>
                  <SelectItem value="category-asc">Categoria (A-Z)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli account</SelectItem>
                  {accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {datePreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <DatePicker value={customDateFrom} onChange={setCustomDateFrom} placeholder="Data inizio" isOptional />
                <DatePicker value={customDateTo} onChange={setCustomDateTo} placeholder="Data fine" isOptional />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={filterRecurring} onValueChange={setFilterRecurring}>
                <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le frequenze</SelectItem>
                  <SelectItem value="recurring">Solo ricorrenti</SelectItem>
                  <SelectItem value="oneoff">Solo singole</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
                <Switch checked={showDetectedOnly} onCheckedChange={setShowDetectedOnly} />
                <span className="text-xs">Solo ricorrenti rilevate</span>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={exportFilteredCsv}>
                <Download className="w-4 h-4 mr-1" />Export CSV
              </Button>
            </div>

            {allAvailableTags.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Filtra per tag (multi-select)</p>
                <div className="flex flex-wrap gap-1.5">
                  {allAvailableTags.slice(0, 24).map((tag) => {
                    const active = selectedTagFilters.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTagFilter(tag)}
                        className={`text-xs rounded-full border px-2 py-1 transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/40'}`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <Input
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder="Nome vista filtri (es. Solo auto)"
                className="h-9"
                onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), saveCurrentView())}
              />
              <Button type="button" variant="outline" size="sm" onClick={saveCurrentView}>
                <Save className="w-4 h-4 mr-1" />Salva vista
              </Button>
            </div>

            {savedViews.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {savedViews.map((view) => (
                  <div key={view.id} className="inline-flex items-center rounded-full border border-border bg-background px-2 py-1 gap-1">
                    <button type="button" className="text-xs hover:text-primary" onClick={() => applySavedView(view.id)}>{view.name}</button>
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => deleteSavedView(view.id)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Regole automatiche — collapsible */}
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
            onClick={() => setRulesOpen((v) => !v)}
          >
            <span className="flex items-center gap-2">
              Regole automatiche nota → categoria
              {autoRules.length > 0 && (
                <span className="rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 py-0.5 leading-none">{autoRules.length}</span>
              )}
            </span>
            {rulesOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {rulesOpen && (
            <div className="px-3 pb-3 space-y-2 border-t border-border bg-muted/20">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 pt-2">
                <Input
                  value={newRuleKeyword}
                  onChange={(event) => setNewRuleKeyword(event.target.value)}
                  placeholder="Parola chiave (es. supermercato)"
                  onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addAutoRule())}
                />
                <Select value={newRuleCategoryId} onValueChange={setNewRuleCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.filter((category) => category.type === 'expense').map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addAutoRule}>Aggiungi</Button>
              </div>
              {autoRules.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {autoRules.map((rule) => (
                    <div key={rule.id} className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs">
                      <span>"{rule.keyword}" → {categories.find((category) => category.id === rule.categoryId)?.name || 'Categoria'}</span>
                      <button type="button" onClick={() => removeAutoRule(rule.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {recurringCandidates.length > 0 && (
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rilevamento ricorrenze (ultimi 90 giorni)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recurringCandidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{candidate.note}</p>
                    <p className="text-xs text-muted-foreground">
                      {candidate.count} movimenti · {fmt(candidate.amount)} · intervallo medio {Math.round(candidate.avgInterval)} giorni
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-xs">Ricorrente</Label>
                    <Checkbox
                      checked={candidate.alreadyRecurring}
                      onCheckedChange={(checked) => markCandidateAsRecurring(candidate.id, Boolean(checked))}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action bar */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <CsvImport />
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={openSubscriptionDialog}>
            <Repeat className="w-4 h-4 mr-1" />Abbonamento
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />Nuova
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{form.recurring ? 'Nuova spesa fissa' : 'Nuova transazione'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Importo (€)</Label>
                    <Input type="number" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v: 'income' | 'expense' | 'transfer') => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Spesa</SelectItem>
                        <SelectItem value="income">Entrata</SelectItem>
                        <SelectItem value="transfer">Trasferimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account origine</Label>
                  <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.type === 'transfer' && (
                  <div className="space-y-2">
                    <Label>Account destinazione</Label>
                    <Select value={form.to_account_id} onValueChange={v => setForm(f => ({ ...f, to_account_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Seleziona account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.id !== (form.account_id || accounts[0]?.id)).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.type !== 'transfer' && (
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c.type === form.type).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Data</Label>
                  <DatePicker value={form.date} onChange={(date) => setForm(f => ({ ...f, date }))} placeholder="Seleziona data" />
                </div>
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Input
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder={form.recurring ? 'Es. Netflix, palestra, internet casa' : 'Opzionale'}
                  />
                </div>
                {form.type !== 'transfer' && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label htmlFor="recurring-expense" className="text-sm font-medium">Spesa fissa o abbonamento</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Salva questa voce come uscita ricorrente mensile o annuale e genera i prossimi addebiti.
                        </p>
                      </div>
                      <Switch
                        id="recurring-expense"
                        checked={form.recurring}
                        onCheckedChange={(checked) => setForm((current) => ({
                          ...current,
                          recurring: checked,
                          recurrence_type: checked ? current.recurrence_type : 'monthly',
                        }))}
                      />
                    </div>

                    {form.recurring && (
                      <div className="space-y-2">
                        <Label>Frequenza</Label>
                        <Select
                          value={form.recurrence_type}
                          onValueChange={(value: 'monthly' | 'yearly') => setForm((current) => ({ ...current, recurrence_type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Ogni mese</SelectItem>
                            <SelectItem value="yearly">Ogni anno</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                <Button type="submit" className="w-full">
                  {form.recurring ? 'Aggiungi spesa fissa' : 'Aggiungi transazione'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <Card className="glass-card border-primary/30">
          <CardContent className="p-3 grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
            <p className="text-sm font-medium">{selectedIds.size} selezionate</p>
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger><SelectValue placeholder="Cambia categoria" /></SelectTrigger>
              <SelectContent>
                {categories.filter((category) => category.type === 'expense' || category.type === 'income').map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={bulkTagsInput} onChange={(event) => setBulkTagsInput(event.target.value)} placeholder="Tag da aggiungere (es. casa, urgente)" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={applyBulkCategory} disabled={!bulkCategoryId}>Categoria</Button>
              <Button type="button" variant="outline" onClick={applyBulkTags} disabled={parseTags(bulkTagsInput).length === 0}>Tag</Button>
              <Button type="button" variant="outline" onClick={exportSelectedCsv}>CSV selezione</Button>
              <Button type="button" variant="destructive" onClick={deleteSelected}>Elimina</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {txLoading ? (
        <TransactionListSkeleton count={6} />
      ) : (
      <Card className="glass-card">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Nessuna transazione trovata con i filtri correnti.</p>
              {hasActiveFilters && (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Ripristina filtri</Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="px-4 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-3">
                <Checkbox checked={allFilteredSelected} onCheckedChange={(checked) => toggleSelectAllFiltered(Boolean(checked))} />
                <span className="text-xs text-muted-foreground">Seleziona tutti i risultati filtrati</span>
              </div>
              {filtered.map(t => {
                const cat = categories.find(c => c.id === t.category_id);
                const account = accounts.find(a => a.id === t.account_id);
                const toAccount = accounts.find(a => a.id === t.to_account_id);
                const isEditing = editingId === t.id;
                return (
                  <div
                    key={t.id}
                    className="px-4 py-3 hover:bg-accent/30 transition-colors"
                    onTouchStart={(event) => handleSwipeStart(event.changedTouches[0].clientX)}
                    onTouchEnd={(event) => handleSwipeEnd(t.id, event.changedTouches[0].clientX)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 w-full">
                        <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={(checked) => toggleSelection(t.id, Boolean(checked))} className="mt-1" />
                        <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: cat?.color || '#888' }} />
                        <div className="min-w-0">
                          {!isEditing ? (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium truncate">{t.type === 'transfer' ? 'Trasferimento interno' : (cat?.name || 'Senza categoria')}</p>
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                  {t.type === 'income' ? 'Entrata' : t.type === 'expense' ? 'Spesa' : 'Trasferimento'}
                                </Badge>
                                {t.recurring && (
                                  <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                                    <CalendarRange className="w-3 h-3" />
                                    {t.recurrence_type === 'yearly' ? 'Annuale' : 'Mensile'}
                                  </Badge>
                                )}
                                {t.type === 'expense' && averageExpenseAmount > 0 && Number(t.amount) > averageExpenseAmount * 1.8 && (
                                  <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300 bg-orange-50">
                                    <AlertTriangle className="w-3 h-3" />Anomalia
                                  </Badge>
                                )}
                                {(t.tags || []).includes('refund') && (
                                  <Badge variant="secondary" className="text-[10px]">Rimborso</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {format(parseISO(t.date), 'dd MMM yyyy', { locale: it })}
                                {t.type === 'transfer'
                                  ? `${account?.name ? ` · da ${account.name}` : ''}${toAccount?.name ? ` a ${toAccount.name}` : ''}`
                                  : account?.name ? ` · ${account.name}` : ''}
                                {t.notes ? ` · ${t.notes}` : ''}
                                {t.tags && t.tags.length > 0 ? ` · #${t.tags.join(' #')}` : ''}
                              </p>
                            </>
                          ) : (
                            <div className="space-y-2 w-full max-w-xl">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingForm?.amount || ''}
                                  onChange={(event) => setEditingForm((current) => current ? ({ ...current, amount: event.target.value }) : current)}
                                />
                                <DatePicker 
                                  value={editingForm?.date || ''} 
                                  onChange={(date) => setEditingForm((current) => current ? ({ ...current, date }) : current)}
                                  placeholder="Seleziona data"
                                />
                              </div>
                              {t.type !== 'transfer' && (
                                <Select
                                  value={editingForm?.category_id || ''}
                                  onValueChange={(value) => setEditingForm((current) => current ? ({ ...current, category_id: value }) : current)}
                                >
                                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                                  <SelectContent>
                                    {categories.filter((category) => category.type === t.type).map((category) => (
                                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Input
                                value={editingForm?.notes || ''}
                                onChange={(event) => setEditingForm((current) => current ? ({ ...current, notes: event.target.value }) : current)}
                                placeholder="Note"
                              />
                              <Input
                                value={editingForm?.tagsInput || ''}
                                onChange={(event) => setEditingForm((current) => current ? ({ ...current, tagsInput: event.target.value }) : current)}
                                placeholder="Tag separati da virgola"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`text-sm font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : 'text-primary'}`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔'}{fmt(Number(t.amount))}
                      </span>
                    </div>
                    <div className="hidden sm:flex justify-end mt-2">
                      {!isEditing ? (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => startInlineEdit(t)} title="Modifica inline">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => saveInlineEdit(t)} title="Salva">
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={cancelInlineEdit} title="Annulla">
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => duplicateTransaction(t)} title="Duplica transazione">
                        <Copy className="w-4 h-4" />
                      </Button>
                      {t.type === 'expense' && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => handleTrackedRefund(t)} title="Rimborso tracciato">
                          <Repeat className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {swipedId === t.id && !isEditing && (
                      <div className="sm:hidden mt-2 grid grid-cols-4 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startInlineEdit(t)}>
                          <Pencil className="w-4 h-4 mr-1" />Modifica
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => duplicateTransaction(t)}>
                          <Copy className="w-4 h-4 mr-1" />Duplica
                        </Button>
                        {t.type === 'expense' ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => handleTrackedRefund(t)}>
                            <Repeat className="w-4 h-4 mr-1" />Rimb.
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" onClick={() => setSwipedId(null)}>
                            <X className="w-4 h-4 mr-1" />Chiudi
                          </Button>
                        )}
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-4 h-4 mr-1" />Elimina
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Storico modifiche (audit locale)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {auditEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessuna azione registrata.</p>
          ) : (
            auditEntries.slice(0, 12).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div>
                  <p className="font-medium text-foreground">{entry.action}</p>
                  <p className="text-muted-foreground">{entry.summary}</p>
                </div>
                <span className="text-muted-foreground whitespace-nowrap">{format(parseISO(entry.at), 'dd MMM HH:mm', { locale: it })}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
