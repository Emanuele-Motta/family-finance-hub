// Author: Emanuele Motta
// Date: 16-Apr-2026
// Unit tests for critical services: reconciliation, rules, forecasts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ImportPendingTransaction, Transaction, RuleCondition } from '@/types/finance';
import {
  calculateMatchScore,
  calculateStringSimilarity,
} from '@/services/reconciliationService';
import {
  evaluateCondition,
  evaluateRule,
  createCondition,
} from '@/services/transactionRulesService';
import {
  calculateNextOccurrence,
  generateOccurrences,
  createMonthlyTemplate,
} from '@/services/recurringService';
import { addMonths, format, addDays } from 'date-fns';

// ============================================================================
// RECONCILIATION SERVICE TESTS
// ============================================================================

describe('Reconciliation Service', () => {
  describe('calculateStringSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(calculateStringSimilarity('test', 'test')).toBe(1);
    });

    it('returns >0.8 for strings with one containing the other', () => {
      const similarity = calculateStringSimilarity('pizzeria roma', 'roma');
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('returns lower value for different strings', () => {
      const similarity = calculateStringSimilarity('esselunga', 'carrefour');
      expect(similarity).toBeLessThan(0.5);
    });

    it('is case-insensitive', () => {
      expect(calculateStringSimilarity('Test', 'test')).toBe(1);
    });
  });

  describe('calculateMatchScore', () => {
    const mockImport: ImportPendingTransaction = {
      id: '1',
      import_batch_id: '1',
      family_group_id: '1',
      row_index: 1,
      raw_data: {},
      date: '2026-04-16',
      amount: 50.0,
      description: 'Pizzeria Roma',
      category_id: null,
      account_id: '1',
      tags: null,
      notes: null,
      status: 'pending',
      matched_transaction_id: null,
      duplicate_score: null,
      is_reviewed: false,
      reviewed_by: null,
      created_at: '2026-04-16T00:00:00Z',
      updated_at: '2026-04-16T00:00:00Z',
    };

    const mockExisting: Transaction = {
      id: '2',
      family_group_id: '1',
      user_id: '1',
      created_by_user_id: '1',
      paid_by_user_id: null,
      category_id: null,
      account_id: '1',
      to_account_id: null,
      amount: 49.99,
      type: 'expense',
      date: '2026-04-16',
      notes: 'Pizzeria Roma',
      recurring: false,
      recurrence_type: null,
      tags: null,
      created_at: '2026-04-16T00:00:00Z',
    };

    it('returns high score for very similar transactions', () => {
      const score = calculateMatchScore(mockImport, mockExisting);
      expect(score.total).toBeGreaterThan(0.8);
    });

    it('includes date score in calculation', () => {
      const score = calculateMatchScore(mockImport, mockExisting);
      expect(score.dateMatch).toBe(1); // Same day
    });

    it('includes amount score in calculation', () => {
      const score = calculateMatchScore(mockImport, mockExisting);
      expect(score.amountMatch).toBeGreaterThan(0.95); // Almost identical
    });
  });
});

// ============================================================================
// TRANSACTION RULES SERVICE TESTS
// ============================================================================

describe('Transaction Rules Service', () => {
  describe('evaluateCondition', () => {
    const mockTx: Transaction = {
      id: '1',
      family_group_id: '1',
      user_id: '1',
      created_by_user_id: '1',
      paid_by_user_id: null,
      category_id: null,
      account_id: '1',
      to_account_id: null,
      amount: 25.5,
      type: 'expense',
      date: '2026-04-16',
      notes: 'Spotify subscription',
      recurring: false,
      recurrence_type: null,
      tags: ['subscription'],
      created_at: '2026-04-16T00:00:00Z',
    };

    it('evaluates contains operator', () => {
      const condition: RuleCondition = {
        field: 'description',
        operator: 'contains',
        value: 'Spotify',
      };
      expect(evaluateCondition(condition, mockTx)).toBe(true);
    });

    it('evaluates not_contains operator', () => {
      const condition: RuleCondition = {
        field: 'description',
        operator: 'not_contains',
        value: 'Amazon',
      };
      expect(evaluateCondition(condition, mockTx)).toBe(true);
    });

    it('evaluates amount comparison operators', () => {
      const condition: RuleCondition = {
        field: 'amount',
        operator: 'gte',
        value: 20,
      };
      expect(evaluateCondition(condition, mockTx)).toBe(true);
    });

    it('evaluates regex operator', () => {
      const condition: RuleCondition = {
        field: 'description',
        operator: 'regex',
        value: '(spotify|netflix|amazon)',
      };
      expect(evaluateCondition(condition, mockTx)).toBe(true);
    });

    it('evaluates in operator', () => {
      const condition: RuleCondition = {
        field: 'type',
        operator: 'in',
        value: ['expense', 'transfer'],
      };
      expect(evaluateCondition(condition, mockTx)).toBe(true);
    });
  });

  describe('evaluateRule', () => {
    const mockTx: Transaction = {
      id: '1',
      family_group_id: '1',
      user_id: '1',
      created_by_user_id: '1',
      paid_by_user_id: null,
      category_id: null,
      account_id: '1',
      to_account_id: null,
      amount: 100,
      type: 'expense',
      date: '2026-04-16',
      notes: 'Large purchase at store',
      recurring: false,
      recurrence_type: null,
      tags: null,
      created_at: '2026-04-16T00:00:00Z',
    };

    it('returns false for inactive rules', () => {
      const rule = {
        id: '1',
        family_group_id: '1',
        name: 'Test rule',
        is_active: false,
        priority: 100,
        condition_type: 'all_match' as const,
        conditions: [
          { field: 'amount', operator: 'gte' as const, value: 50 },
        ],
        category_id: null,
        tags: null,
        account_id: null,
        auto_apply: true,
        require_review: false,
        created_by: '1',
        created_at: '2026-04-16T00:00:00Z',
        updated_at: '2026-04-16T00:00:00Z',
      };

      expect(evaluateRule(rule, mockTx)).toBe(false);
    });

    it('evaluates all_match mode correctly', () => {
      const rule = {
        id: '1',
        family_group_id: '1',
        name: 'High value expense',
        is_active: true,
        priority: 100,
        condition_type: 'all_match' as const,
        conditions: [
          { field: 'amount', operator: 'gte' as const, value: 50 },
          { field: 'type', operator: 'equals' as const, value: 'expense' },
        ],
        category_id: null,
        tags: null,
        account_id: null,
        auto_apply: true,
        require_review: false,
        created_by: '1',
        created_at: '2026-04-16T00:00:00Z',
        updated_at: '2026-04-16T00:00:00Z',
      };

      expect(evaluateRule(rule, mockTx)).toBe(true);
    });

    it('evaluates any_match mode correctly', () => {
      const rule = {
        id: '1',
        family_group_id: '1',
        name: 'Subscription or entertainment',
        is_active: true,
        priority: 100,
        condition_type: 'any_match' as const,
        conditions: [
          { field: 'tags', operator: 'contains' as const, value: 'subscription' },
          { field: 'description', operator: 'contains' as const, value: 'cinema' },
        ],
        category_id: null,
        tags: null,
        account_id: null,
        auto_apply: true,
        require_review: false,
        created_by: '1',
        created_at: '2026-04-16T00:00:00Z',
        updated_at: '2026-04-16T00:00:00Z',
      };

      // This should be false because the transaction doesn't have 'subscription' tag
      // and description doesn't contain 'cinema'
      expect(evaluateRule(rule, mockTx)).toBe(false);
    });
  });
});

// ============================================================================
// RECURRING SERVICE TESTS
// ============================================================================

describe('Recurring Service', () => {
  describe('calculateNextOccurrence', () => {
    it('calculates next occurrence for daily frequency', () => {
      const template = {
        frequency: 'daily' as const,
        interval: 1,
      };
      const baseDate = new Date('2026-04-16');
      const next = calculateNextOccurrence(template as any, baseDate);
      expect(next.getDate()).toBe(17);
    });

    it('calculates next occurrence for monthly frequency', () => {
      const template = {
        frequency: 'monthly' as const,
        interval: 1,
        day_of_month: 15,
      };
      const baseDate = new Date('2026-04-10');
      const next = calculateNextOccurrence(template as any, baseDate);
      expect(next.getMonth()).toBe(4); // May
      expect(next.getDate()).toBe(15);
    });

    it('handles end-of-month edge case', () => {
      const template = {
        frequency: 'monthly' as const,
        interval: 1,
        day_of_month: 31,
      };
      const baseDate = new Date('2026-02-01'); // February
      const next = calculateNextOccurrence(template as any, baseDate);
      // February only has 28 days, so should be Feb 28
      expect(next.getDate()).toBe(28);
    });

    it('calculates next occurrence for yearly frequency', () => {
      const template = {
        frequency: 'yearly' as const,
        interval: 1,
      };
      const baseDate = new Date('2026-04-16');
      const next = calculateNextOccurrence(template as any, baseDate);
      expect(next.getFullYear()).toBe(2027);
    });
  });

  describe('generateOccurrences', () => {
    it('generates correct number of occurrences', () => {
      const template = {
        frequency: 'daily' as const,
        interval: 1,
        starts_at: '2026-04-16',
        ends_at: null,
        max_occurrences: 5,
      };
      const startDate = new Date('2026-04-16');
      const endDate = new Date('2026-04-30');
      const occurrences = generateOccurrences(template as any, startDate, endDate);
      expect(occurrences.length).toBe(5);
    });

    it('respects date range boundaries', () => {
      const template = {
        frequency: 'daily' as const,
        interval: 1,
        starts_at: '2026-04-16',
        ends_at: null,
        max_occurrences: null,
      };
      const startDate = new Date('2026-04-16');
      const endDate = new Date('2026-04-20');
      const occurrences = generateOccurrences(template as any, startDate, endDate);
      expect(occurrences.length).toBeLessThanOrEqual(4);
    });

    it('respects max_occurrences limit', () => {
      const template = {
        frequency: 'daily' as const,
        interval: 1,
        starts_at: '2026-04-16',
        ends_at: null,
        max_occurrences: 3,
      };
      const startDate = new Date('2026-04-16');
      const endDate = new Date('2026-12-31');
      const occurrences = generateOccurrences(template as any, startDate, endDate);
      expect(occurrences.length).toBe(3);
    });

    it('respects ends_at date', () => {
      const template = {
        frequency: 'daily' as const,
        interval: 1,
        starts_at: '2026-04-16',
        ends_at: '2026-04-20',
        max_occurrences: null,
      };
      const startDate = new Date('2026-04-16');
      const endDate = new Date('2026-12-31');
      const occurrences = generateOccurrences(template as any, startDate, endDate);
      const last = occurrences[occurrences.length - 1] as unknown as Date;
      expect(new Date(last as unknown as string).getTime()).toBeLessThanOrEqual(
        new Date('2026-04-20').getTime()
      );
    });
  });
});

// ============================================================================
// HELPER TESTS
// ============================================================================

describe('Helper Functions', () => {
  describe('createCondition', () => {
    it('creates a properly formatted condition', () => {
      const condition = createCondition('description', 'contains', 'test');
      expect(condition.field).toBe('description');
      expect(condition.operator).toBe('contains');
      expect(condition.value).toBe('test');
    });
  });

  describe('createMonthlyTemplate', () => {
    it('creates a monthly template with correct properties', () => {
      const template = createMonthlyTemplate({
        familyGroupId: '1',
        name: 'Monthly rent',
        amount: 1200,
        dayOfMonth: 1,
        category_id: '1',
        account_id: '1',
        description: 'Affitto',
        created_by: '1',
      });

      expect(template.frequency).toBe('monthly');
      expect(template.day_of_month).toBe(1);
      expect(template.amount).toBe(1200);
      expect(template.is_active).toBe(true);
    });
  });
});
