import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/appStore';
import type { Transaction, Category, Budget, Goal, Debt, Account } from '@/types/finance';

export function useTransactions() {
  const { currentFamilyGroupId } = useAppStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentFamilyGroupId) return;
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('family_group_id', currentFamilyGroupId)
      .order('date', { ascending: false });
    setTransactions((data as Transaction[]) || []);
    setLoading(false);
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addTransaction = async (t: Omit<Transaction, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('transactions').insert(t as any);
    if (error) throw error;
    await fetch();
  };

  const updateTransaction = async (id: string, t: Partial<Transaction>) => {
    const { error } = await supabase.from('transactions').update(t as any).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deleteTransaction = async (id: string) => {
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
      const { data } = await supabase.from('categories').select('*');
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
    if (!currentFamilyGroupId) return;
    setLoading(true);
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('family_group_id', currentFamilyGroupId);
    setBudgets((data as Budget[]) || []);
    setLoading(false);
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
    if (!currentFamilyGroupId) return;
    setLoading(true);
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('family_group_id', currentFamilyGroupId);
    setGoals((data as Goal[]) || []);
    setLoading(false);
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
    if (!currentFamilyGroupId) return;
    setLoading(true);
    const { data } = await supabase
      .from('debts')
      .select('*')
      .eq('family_group_id', currentFamilyGroupId);
    setDebts((data as Debt[]) || []);
    setLoading(false);
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
    if (!currentFamilyGroupId) return;
    setLoading(true);
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('family_group_id', currentFamilyGroupId)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true });
    setAccounts((data as Account[]) || []);
    setLoading(false);
  }, [currentFamilyGroupId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { accounts, loading, refetch: fetch };
}
