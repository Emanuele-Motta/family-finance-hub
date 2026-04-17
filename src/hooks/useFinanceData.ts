import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/appStore';
import { createRecurringTemplate, generateRecurringOccurrences, updateRecurringTemplate } from '@/services/recurringService';
import { addOfflineChange } from '@/services/backupService';
import type { Transaction, Category, Budget, Goal, Debt, Account, RecurringTemplate } from '@/types/finance';

export function useTransactions() {
  const { currentFamilyGroupId } = useAppStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId)
        .order('date', { ascending: false });
      setTransactions((data as Transaction[]) || []);
    } finally {
      setLoading(false);
    }
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addTransaction = async (t: Omit<Transaction, 'id' | 'created_at'>) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addOfflineChange({ type: 'transaction', action: 'create', data: t as Record<string, unknown> });
    }
    const { error } = await supabase.from('transactions').insert(t as any);
    if (error) throw error;
    await fetch();
  };

  const updateTransaction = async (id: string, t: Partial<Transaction>) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addOfflineChange({ type: 'transaction', action: 'update', data: { id, ...t } as Record<string, unknown> });
    }
    const { error } = await supabase.from('transactions').update(t as any).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deleteTransaction = async (id: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addOfflineChange({ type: 'transaction', action: 'delete', data: { id } });
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, refetch: fetch };
}

export function useCategories() {
  const { currentFamilyGroupId } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetch = async () => {
      if (!currentFamilyGroupId) {
        setCategories([]);
        return;
      }

      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId);
      setCategories((data as Category[]) || []);
    };
    fetch();
  }, [currentFamilyGroupId]);

  return categories;
}

export function useBudgets() {
  const { currentFamilyGroupId } = useAppStore();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from('budgets')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId);
      setBudgets((data as Budget[]) || []);
    } finally {
      setLoading(false);
    }
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addBudget = async (b: Omit<Budget, 'id'>) => {
    const { error } = await supabase.from('budgets').insert(b as any);
    if (error) throw error;
    await fetch();
  };

  const updateBudget = async (id: string, b: Partial<Budget>) => {
    const { error } = await supabase.from('budgets').update(b as any).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deleteBudget = async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { budgets, loading, addBudget, updateBudget, deleteBudget, refetch: fetch };
}

export function useGoals() {
  const { currentFamilyGroupId } = useAppStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId);
      setGoals((data as Goal[]) || []);
    } finally {
      setLoading(false);
    }
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addGoal = async (g: Omit<Goal, 'id'>) => {
    const { error } = await supabase.from('goals').insert(g as any);
    if (error) throw error;
    await fetch();
  };

  const updateGoal = async (id: string, g: Partial<Goal>) => {
    const { error } = await supabase.from('goals').update(g as any).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { goals, loading, addGoal, updateGoal, deleteGoal, refetch: fetch };
}

export function useDebts() {
  const { currentFamilyGroupId } = useAppStore();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) {
      setDebts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from('debts')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId);
      setDebts((data as Debt[]) || []);
    } finally {
      setLoading(false);
    }
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addDebt = async (d: Omit<Debt, 'id'>) => {
    const { error } = await supabase.from('debts').insert(d as any);
    if (error) throw error;
    await fetch();
  };

  const updateDebt = async (id: string, d: Partial<Debt>) => {
    const { error } = await supabase.from('debts').update(d as any).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deleteDebt = async (id: string) => {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { debts, loading, addDebt, updateDebt, deleteDebt, refetch: fetch };
}

export function useAccounts() {
  const { currentFamilyGroupId } = useAppStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('family_group_id', currentFamilyGroupId)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true });
      setAccounts((data as Account[]) || []);
    } finally {
      setLoading(false);
    }
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateAccount = async (id: string, account: Partial<Account>) => {
    const { error } = await supabase.from('accounts').update(account as any).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { accounts, loading, updateAccount, refetch: fetch };
}

export function useRecurringTemplates() {
  const { currentFamilyGroupId } = useAppStore();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('family_group_id', currentFamilyGroupId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    setTemplates((data as RecurringTemplate[]) || []);
    setLoading(false);
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addTemplate = async (template: Omit<RecurringTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    await createRecurringTemplate(template);
    await fetch();
  };

  const updateTemplate = async (id: string, updates: Partial<RecurringTemplate>) => {
    if (!currentFamilyGroupId) return;
    await updateRecurringTemplate(id, updates);
    await generateRecurringOccurrences(id, currentFamilyGroupId);
    await fetch();
  };

  const toggleTemplate = async (id: string, isActive: boolean) => {
    await updateTemplate(id, { is_active: isActive });
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('recurring_occurrences').delete().eq('template_id', id);
    const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { templates, loading, addTemplate, updateTemplate, toggleTemplate, deleteTemplate, refetch: fetch };
}
