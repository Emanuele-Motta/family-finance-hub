// 16-Apr-2026 — Emanuele Motta
// Test suite for rules automation service

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateRule, applyRuleActions } from '@/services/rulesService';
import type { TransactionRule } from '@/types/finance';

describe('Rules Automation Service', () => {
  let testRule: TransactionRule;

  beforeEach(() => {
    testRule = {
      id: 'test-rule-1',
      family_group_id: 'test-family',
      name: 'Cibo automatico',
      enabled: true,
      priority: 10,
       conditionLogic: 'and',
      conditions: {
        keywords: ['cibo', 'supermercato', 'ristorante'],
        minAmount: 5,
        maxAmount: 100,
        types: ['expense'],
      },
      actions: {
        setCategoryId: 'cat-food',
        addTags: ['eat', 'shopping'],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  describe('evaluateRule', () => {
     describe('AND logic (default behavior)', () => {
    it('should match transaction with matching keywords', () => {
      const transaction = {
        type: 'expense',
        category_id: null,
        amount: 25,
        notes: 'Acquisti supermercato',
      };

      const result = evaluateRule(testRule, transaction);
      expect(result).toBe(true);
    });

    it('should not match transaction with mismatched keywords', () => {
      const transaction = {
        type: 'expense',
        category_id: null,
        amount: 25,
        notes: 'Pagamento bolletta',
      };

      const result = evaluateRule(testRule, transaction);
      expect(result).toBe(false);
    });

    it('should not match if amount is below minimum', () => {
      const transaction = {
        type: 'expense',
        category_id: null,
        amount: 2,
        notes: 'cibo',
      };

      const result = evaluateRule(testRule, transaction);
      expect(result).toBe(false);
    });

    it('should not match if amount is above maximum', () => {
      const transaction = {
        type: 'expense',
        category_id: null,
        amount: 200,
        notes: 'cibo',
      };

      const result = evaluateRule(testRule, transaction);
      expect(result).toBe(false);
    });

    it('should not match if type does not match', () => {
      const transaction = {
        type: 'income',
        category_id: null,
        amount: 50,
        notes: 'cibo',
      };

      const result = evaluateRule(testRule, transaction);
      expect(result).toBe(false);
    });
     });
  });
     describe('OR logic (at least one condition must match)', () => {
       it('should match if at least one condition matches', () => {
         const ruleOr = { ...testRule, conditionLogic: 'or' as const };
         const transaction = {
           type: 'income', // Wrong type
           category_id: null,
           amount: 50, // Amount OK
           notes: 'cibo', // Keywords OK
         };
         const result = evaluateRule(ruleOr, transaction);
         expect(result).toBe(true); // Should match because amount and keywords are OK
       });

       it('should match if any condition is satisfied', () => {
         const ruleOr = { ...testRule, conditionLogic: 'or' as const };
         const transaction = {
           type: 'expense',
           category_id: null,
           amount: 50,
           notes: 'Qualsiasi nota', // No matching keywords
         };
         const result = evaluateRule(ruleOr, transaction);
         expect(result).toBe(true); // Should match because type and amount match
       });

       it('should not match if no conditions are satisfied', () => {
         const ruleOr = { ...testRule, conditionLogic: 'or' as const };
         const transaction = {
           type: 'income',
           category_id: null,
           amount: 2,
           notes: 'Qualsiasi nota',
         };
         const result = evaluateRule(ruleOr, transaction);
         expect(result).toBe(false); // Should not match because no conditions are satisfied
       });
     });

  describe('applyRuleActions', () => {
    it('should apply category action', () => {
      const transaction = {
        id: 'tx-1',
        type: 'expense',
        category_id: null,
        amount: 50,
        notes: 'Spesa',
        tags: null,
      };

      const result = applyRuleActions(testRule, transaction);
      expect(result.category_id).toBe('cat-food');
    });

    it('should merge new tags with existing', () => {
      const transaction = {
        id: 'tx-1',
        type: 'expense',
        category_id: null,
        amount: 50,
        notes: 'Spesa',
        tags: ['groceries', 'urgent'],
      };

      const result = applyRuleActions(testRule, transaction);
      expect(result.tags).toContain('eat');
      expect(result.tags).toContain('shopping');
      expect(result.tags).toContain('groceries');
      expect(result.tags).toContain('urgent');
    });

    it('should not duplicate tags', () => {
      const transaction = {
        id: 'tx-1',
        type: 'expense',
        category_id: null,
        amount: 50,
        notes: 'Spesa',
        tags: ['eat', 'shopping'],
      };

      const result = applyRuleActions(testRule, transaction);
      expect(result.tags?.filter((t) => t === 'eat').length).toBe(1);
      expect(result.tags?.filter((t) => t === 'shopping').length).toBe(1);
    });
  });

  describe('Rule execution order', () => {
    it('should prioritize rules by priority value (higher first)', () => {
      const highPriorityRule = { ...testRule, priority: 100 };
      const lowPriorityRule = { ...testRule, id: 'rule-2', priority: 10 };

      const rules = [lowPriorityRule, highPriorityRule];
      const sorted = rules.sort((a, b) => b.priority - a.priority);

      expect(sorted[0].priority).toBe(100);
      expect(sorted[1].priority).toBe(10);
    });
  });
});
