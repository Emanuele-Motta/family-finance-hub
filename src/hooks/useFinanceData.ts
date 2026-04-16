import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/appStore';
import type { Transaction, Category, Budget, Goal, Debt } from '@/types/finance';

type WithId = { id: string };
type Insertable<T> = Omit<T, 'id' | 'created_at'>;
type CrudHookReturn<T extends WithId> = {
  data: T[];
  loading: boolean;
  add: (item: Insertable<T>) => Promise<void>;
  update: (id: string, item: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
};

function useFamilyCrudData<T extends WithId>(
  tableName: string,
  options?: { orderByDateDesc?: boolean },
): CrudHookReturn<T> {
  const { currentFamilyGroupId } = useAppStore();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    let query = supabase.from(tableName).select('*').eq('family_group_id', currentFamilyGroupId);
    if (options?.orderByDateDesc) {
      query = query.order('date', { ascending: false });
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    setData((rows as T[]) || []);
    setLoading(false);
  }, [currentFamilyGroupId, options?.orderByDateDesc, tableName]);

  useEffect(() => {
    fetch().catch(() => setLoading(false));
  }, [fetch]);

  const add = async (item: Insertable<T>) => {
    const { error } = await supabase.from(tableName).insert(item as any);
    if (error) throw error;
    await fetch();
  };

  const update = async (id: string, item: Partial<T>) => {
    const { error } = await supabase.from(tableName).update(item as any).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { data, loading, add, update, remove, refetch: fetch };
}

export function useTransactions() {
  const { data, loading, add, update, remove, refetch } = useFamilyCrudData<Transaction>(
    'transactions',
    { orderByDateDesc: true },
  );

  const addTransaction = async (t: Omit<Transaction, 'id' | 'created_at'>) => {
    await add(t);
  };

  return {
    transactions: data,
    loading,
    addTransaction,
    updateTransaction: update,
    deleteTransaction: remove,
    refetch,
  };
}

export function useCategories() {
  const { currentFamilyGroupId } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('categories').select('*');
      setCategories((data as Category[]) || []);
    };
    fetch();
  }, [currentFamilyGroupId]);

  return categories;
}

export function useBudgets() {
  const { data, loading, add, update, remove, refetch } = useFamilyCrudData<Budget>('budgets');

  return {
    budgets: data,
    loading,
    addBudget: add,
    updateBudget: update,
    deleteBudget: remove,
    refetch,
  };
}

export function useGoals() {
  const { data, loading, add, update, remove, refetch } = useFamilyCrudData<Goal>('goals');

  return {
    goals: data,
    loading,
    addGoal: add,
    updateGoal: update,
    deleteGoal: remove,
    refetch,
  };
}

export function useDebts() {
  const { data, loading, add, update, remove, refetch } = useFamilyCrudData<Debt>('debts');

  return {
    debts: data,
    loading,
    addDebt: add,
    updateDebt: update,
    deleteDebt: remove,
    refetch,
  };
}
