import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/appStore';
import { createRecurringTemplate, generateRecurringOccurrences, updateRecurringTemplate } from '@/services/recurringService';
import { addOfflineChange } from '@/services/backupService';
import type { Transaction, Category, Budget, Goal, Debt, Account, RecurringTemplate } from '@/types/finance';

/**
 * All hooks below share the React Query cache so navigating between pages
 * does not re-fetch the same family-scoped data. External API is preserved
 * (data, loading, mutators, refetch) for backward compatibility.
 */

const keys = {
  transactions: (familyId: string) => ['transactions', familyId] as const,
  categories: (familyId: string) => ['categories', familyId] as const,
  budgets: (familyId: string) => ['budgets', familyId] as const,
  goals: (familyId: string) => ['goals', familyId] as const,
  debts: (familyId: string) => ['debts', familyId] as const,
  accounts: (familyId: string) => ['accounts', familyId] as const,
  recurring: (familyId: string) => ['recurring_templates', familyId] as const,
};

export function useTransactions() {
  const { currentFamilyGroupId } = useAppStore();
  const qc = useQueryClient();
  const enabled = !!currentFamilyGroupId;

  const query = useQuery({
    queryKey: keys.transactions(currentFamilyGroupId || ''),
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId!)
        .order('date', { ascending: false });
      return (data as Transaction[]) || [];
    },
  });

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: keys.transactions(currentFamilyGroupId || '') }),
    [qc, currentFamilyGroupId]
  );

  const addTransaction = async (t: Omit<Transaction, 'id' | 'created_at'>) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addOfflineChange({ type: 'transaction', action: 'create', data: t as Record<string, unknown> });
    }
    const { error } = await supabase.from('transactions').insert(t as any);
    if (error) throw error;
    await invalidate();
  };

  const updateTransaction = async (id: string, t: Partial<Transaction>) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addOfflineChange({ type: 'transaction', action: 'update', data: { id, ...t } as Record<string, unknown> });
    }
    const { error } = await supabase.from('transactions').update(t as any).eq('id', id);
    if (error) throw error;
    await invalidate();
  };

  const deleteTransaction = async (id: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addOfflineChange({ type: 'transaction', action: 'delete', data: { id } });
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    await invalidate();
  };

  return {
    transactions: query.data ?? [],
    loading: enabled ? query.isLoading : false,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refetch: async () => { await query.refetch(); },
  };
}

export function useCategories() {
  const { currentFamilyGroupId } = useAppStore();
  const enabled = !!currentFamilyGroupId;

  const query = useQuery({
    queryKey: keys.categories(currentFamilyGroupId || ''),
    enabled,
    staleTime: 5 * 60 * 1000, // categories rarely change
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId!);
      return (data as Category[]) || [];
    },
  });

  return query.data ?? [];
}

function makeCrudHook<TRow extends { id: string }>(
  table: 'budgets' | 'goals' | 'debts',
  keyFn: (familyId: string) => readonly unknown[]
) {
  return function useTable() {
    const { currentFamilyGroupId } = useAppStore();
    const qc = useQueryClient();
    const enabled = !!currentFamilyGroupId;

    const query = useQuery({
      queryKey: keyFn(currentFamilyGroupId || ''),
      enabled,
      queryFn: async () => {
        const { data } = await supabase
          .from(table)
          .select('*')
          .eq('family_group_id', currentFamilyGroupId!);
        return ((data as unknown) as TRow[]) || [];
      },
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: keyFn(currentFamilyGroupId || '') });

    const add = async (row: Omit<TRow, 'id'>) => {
      const { error } = await supabase.from(table).insert(row as any);
      if (error) throw error;
      await invalidate();
    };
    const update = async (id: string, row: Partial<TRow>) => {
      const { error } = await supabase.from(table).update(row as any).eq('id', id);
      if (error) throw error;
      await invalidate();
    };
    const remove = async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      await invalidate();
    };

    return {
      data: query.data ?? [],
      loading: enabled ? query.isLoading : false,
      add,
      update,
      remove,
      refetch: async () => { await query.refetch(); },
    };
  };
}

const useBudgetsBase = makeCrudHook<Budget>('budgets', keys.budgets);
export function useBudgets() {
  const b = useBudgetsBase();
  return {
    budgets: b.data,
    loading: b.loading,
    addBudget: b.add,
    updateBudget: b.update,
    deleteBudget: b.remove,
    refetch: b.refetch,
  };
}

const useGoalsBase = makeCrudHook<Goal>('goals', keys.goals);
export function useGoals() {
  const g = useGoalsBase();
  return {
    goals: g.data,
    loading: g.loading,
    addGoal: g.add,
    updateGoal: g.update,
    deleteGoal: g.remove,
    refetch: g.refetch,
  };
}

const useDebtsBase = makeCrudHook<Debt>('debts', keys.debts);
export function useDebts() {
  const d = useDebtsBase();
  return {
    debts: d.data,
    loading: d.loading,
    addDebt: d.add,
    updateDebt: d.update,
    deleteDebt: d.remove,
    refetch: d.refetch,
  };
}

export function useAccounts() {
  const { currentFamilyGroupId } = useAppStore();
  const qc = useQueryClient();
  const enabled = !!currentFamilyGroupId;

  const query = useQuery({
    queryKey: keys.accounts(currentFamilyGroupId || ''),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId!)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true });
      return (data as Account[]) || [];
    },
  });

  const updateAccount = async (id: string, account: Partial<Account>) => {
    const { error } = await supabase.from('accounts').update(account as any).eq('id', id);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: keys.accounts(currentFamilyGroupId || '') });
  };

  return {
    accounts: query.data ?? [],
    loading: enabled ? query.isLoading : false,
    updateAccount,
    refetch: async () => { await query.refetch(); },
  };
}

export function useRecurringTemplates() {
  const { currentFamilyGroupId } = useAppStore();
  const qc = useQueryClient();
  const enabled = !!currentFamilyGroupId;

  const query = useQuery({
    queryKey: keys.recurring(currentFamilyGroupId || ''),
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from('recurring_templates')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId!)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
      return (data as RecurringTemplate[]) || [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: keys.recurring(currentFamilyGroupId || '') });

  const addTemplate = async (template: Omit<RecurringTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    await createRecurringTemplate(template);
    await invalidate();
  };

  const updateTemplate = async (id: string, updates: Partial<RecurringTemplate>) => {
    if (!currentFamilyGroupId) return;
    await updateRecurringTemplate(id, updates);
    await generateRecurringOccurrences(id, currentFamilyGroupId);
    await invalidate();
  };

  const toggleTemplate = async (id: string, isActive: boolean) => {
    await updateTemplate(id, { is_active: isActive });
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('recurring_occurrences').delete().eq('template_id', id);
    const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
    if (error) throw error;
    await invalidate();
  };

  return {
    templates: query.data ?? [],
    loading: enabled ? query.isLoading : false,
    addTemplate,
    updateTemplate,
    toggleTemplate,
    deleteTemplate,
    refetch: async () => { await query.refetch(); },
  };
}
