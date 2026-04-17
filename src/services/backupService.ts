// 16-Apr-2026 — Emanuele Motta
// Export, backup, e utility per offline

import { supabase } from '@/integrations/supabase/client';
import type { Transaction, Account, Category, TransactionRule } from '@/types/finance';

export interface FamilyFinanceBackup {
  version: string;
  exportedAt: string;
  familyGroupId: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  rules: TransactionRule[];
  metadata: {
    transactionCount: number;
    accountCount: number;
    categoryCount: number;
    ruleCount: number;
  };
}

/**
 * Esporta tutti i dati della famiglia come JSON.
 */
export async function exportFamilyData(
  familyGroupId: string,
  dependencies: {
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
    rules: TransactionRule[];
  }
): Promise<FamilyFinanceBackup> {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    familyGroupId,
    transactions: dependencies.transactions,
    accounts: dependencies.accounts,
    categories: dependencies.categories,
    rules: dependencies.rules,
    metadata: {
      transactionCount: dependencies.transactions.length,
      accountCount: dependencies.accounts.length,
      categoryCount: dependencies.categories.length,
      ruleCount: dependencies.rules.length,
    },
  };
}

/**
 * Scarica backup come file JSON.
 */
export function downloadBackupFile(backup: FamilyFinanceBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `family-finance-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Carica un file di backup e restituisce i dati parsati.
 */
export async function parseBackupFile(file: File): Promise<FamilyFinanceBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as FamilyFinanceBackup;
        resolve(data);
      } catch (error) {
        reject(new Error('File backup non valido'));
      }
    };
    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsText(file);
  });
}

/**
 * Salva dati critici in localStorage per la sincronizzazione offline.
 */
export function saveOfflineSnapshot(backup: FamilyFinanceBackup): void {
  try {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const json = JSON.stringify(backup);
    if (json.length > maxSize) {
      // Se troppo grande, salva solo metadata + recent transactions
      const compacted = {
        ...backup,
        transactions: backup.transactions.slice(0, 100),
      };
      localStorage.setItem('ff_offline_snapshot', JSON.stringify(compacted));
    } else {
      localStorage.setItem('ff_offline_snapshot', json);
    }
  } catch (e) {
    console.warn('Cannot save offline snapshot (storage full)', e);
  }
}

/**
 * Recupera snapshot offline.
 */
export function getOfflineSnapshot(): FamilyFinanceBackup | null {
  try {
    const raw = localStorage.getItem('ff_offline_snapshot');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Pulisce snapshot offline.
 */
export function clearOfflineSnapshot(): void {
  localStorage.removeItem('ff_offline_snapshot');
}

/**
 * Track pending offline changes.
 */
export interface OfflineChange {
  id: string;
  type: 'transaction' | 'account' | 'rule';
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  syncedAt?: string;
}

export function addOfflineChange(change: Omit<OfflineChange, 'id'>): void {
  try {
    const changes: OfflineChange[] = JSON.parse(localStorage.getItem('ff_offline_changes') || '[]');
    changes.push({
      ...change,
      id: `${Date.now()}-${Math.random().toString(36)}`,
    });
    localStorage.setItem('ff_offline_changes', JSON.stringify(changes));
  } catch (e) {
    console.warn('Cannot store offline change', e);
  }
}

export function getOfflineChanges(): OfflineChange[] {
  try {
    return JSON.parse(localStorage.getItem('ff_offline_changes') || '[]');
  } catch {
    return [];
  }
}

export function clearOfflineChanges(): void {
  localStorage.removeItem('ff_offline_changes');
}

/**
 * Sincronizza offline changes al database Supabase
 */
export interface SyncResult {
  status: 'syncing' | 'completed' | 'error';
  synced: number;
  failed: number;
  errors: Array<{ changeId: string; error: string }>;
}

export async function syncOfflineChanges(familyGroupId: string): Promise<SyncResult> {
  const changes = getOfflineChanges();
  if (changes.length === 0) return { status: 'completed', synced: 0, failed: 0, errors: [] };

  const result: SyncResult = {
    status: 'syncing',
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const change of changes) {
    try {
      if (change.type === 'transaction') {
        if (change.action === 'create') {
          const { error } = await supabase.from('transactions').insert(change.data as any);
          if (error) throw error;
        } else if (change.action === 'update') {
          const { id, ...data } = change.data;
          const { error } = await supabase.from('transactions').update(data as any).eq('id', id as string);
          if (error) throw error;
        } else if (change.action === 'delete') {
          const { error } = await supabase.from('transactions').delete().eq('id', change.data.id as string);
          if (error) throw error;
        }
        result.synced++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        changeId: change.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (result.failed === 0) {
    clearOfflineChanges();
    result.status = 'completed';
  } else {
    result.status = 'error';
  }

  return result;
}
