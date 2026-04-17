// 16-Apr-2026 — Emanuele Motta
// Test suite for backup and export service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportFamilyData, parseBackupFile } from '@/services/backupService';
import type { FamilyFinanceBackup } from '@/services/backupService';
import type { Transaction, Account, Category } from '@/types/finance';

describe('Backup Service', () => {
  let mockData: {
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
    rules: any[];
  };

  beforeEach(() => {
    mockData = {
      transactions: [
        {
          id: 'tx-1',
          family_group_id: 'fam-1',
          user_id: 'user-1',
          created_by_user_id: 'user-1',
          paid_by_user_id: 'user-1',
          category_id: 'cat-1',
          account_id: 'acc-1',
          to_account_id: null,
          amount: 50,
          type: 'expense',
          date: '2026-04-16',
          notes: 'Spesa',
          recurring: false,
          recurrence_type: null,
          tags: ['shopping'],
          created_at: '2026-04-16T12:00:00Z',
        } as Transaction,
      ],
      accounts: [
        {
          id: 'acc-1',
          family_group_id: 'fam-1',
          name: 'Checking',
          balance: 1000,
          is_primary: true,
        } as Account,
      ],
      categories: [
        {
          id: 'cat-1',
          family_group_id: 'fam-1',
          name: 'Cibo',
          icon: '🍔',
          type: 'expense',
          color: '#ff6b6b',
          is_default: true,
        } as Category,
      ],
      rules: [
        {
          id: 'rule-1',
          family_group_id: 'fam-1',
          name: 'Auto cibo',
          enabled: true,
          priority: 10,
          conditions: {},
          actions: {},
        },
      ],
    };
  });

  describe('exportFamilyData', () => {
    it('should create valid backup object', async () => {
      const backup = await exportFamilyData('fam-1', mockData);

      expect(backup).toHaveProperty('version');
      expect(backup).toHaveProperty('exportedAt');
      expect(backup).toHaveProperty('familyGroupId', 'fam-1');
      expect(backup).toHaveProperty('transactions');
      expect(backup).toHaveProperty('accounts');
      expect(backup).toHaveProperty('categories');
      expect(backup).toHaveProperty('rules');
      expect(backup).toHaveProperty('metadata');
    });

    it('should include correct counts in metadata', async () => {
      const backup = await exportFamilyData('fam-1', mockData);

      expect(backup.metadata.transactionCount).toBe(1);
      expect(backup.metadata.accountCount).toBe(1);
      expect(backup.metadata.categoryCount).toBe(1);
      expect(backup.metadata.ruleCount).toBe(1);
    });

    it('should include proper exportedAt timestamp', async () => {
      const before = new Date();
      const backup = await exportFamilyData('fam-1', mockData);
      const after = new Date();

      const exportTime = new Date(backup.exportedAt);
      expect(exportTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(exportTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should maintain data integrity', async () => {
      const backup = await exportFamilyData('fam-1', mockData);

      expect(backup.transactions[0].id).toBe('tx-1');
      expect(backup.transactions[0].amount).toBe(50);
      expect(backup.accounts[0].is_primary).toBe(true);
      expect(backup.categories[0].name).toBe('Cibo');
    });
  });

  describe('Backup file operations', () => {
    it('should parse valid JSON backup file', async () => {
      const backupData: FamilyFinanceBackup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        familyGroupId: 'fam-1',
        transactions: mockData.transactions,
        accounts: mockData.accounts,
        categories: mockData.categories,
        rules: mockData.rules,
        metadata: {
          transactionCount: 1,
          accountCount: 1,
          categoryCount: 1,
          ruleCount: 1,
        },
      };

      const json = JSON.stringify(backupData);
      const file = new File([json], 'backup.json', { type: 'application/json' });

      const parsed = await parseBackupFile(file);
      expect(parsed.familyGroupId).toBe('fam-1');
      expect(parsed.transactions.length).toBe(1);
    });

    it('should reject invalid backup file', async () => {
      const invalidJson = 'not valid json {]';
      const file = new File([invalidJson], 'backup.json', { type: 'application/json' });

      expect(parseBackupFile(file)).rejects.toThrow('File backup non valido');
    });
  });

  describe('Offline snapshot', () => {
    it('should handle large backup correctly', async () => {
      // Create large number of transactions
      const largeData = {
        ...mockData,
        transactions: Array.from({ length: 500 }, (_, i) => ({
          ...mockData.transactions[0],
          id: `tx-${i}`,
        })),
      };

      const backup = await exportFamilyData('fam-1', largeData);
      expect(backup.metadata.transactionCount).toBe(500);
    });
  });
});
