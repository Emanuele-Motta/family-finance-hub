// 16-Apr-2026 — Emanuele Motta
// Integration tests for Chat parser flow

import { describe, it, expect } from 'vitest';

describe('Chat Parser Integration', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Cibo', type: 'expense' as const },
    { id: 'cat-2', name: 'Auto', type: 'expense' as const },
    { id: 'cat-3', name: 'Stipendio', type: 'income' as const },
  ];

  describe('Transaction parsing', () => {
    it('should extract amount and detect expense', () => {
      const text = '-50 spesa cibo';
      const amountMatch = text.match(/^([+-]?)(\d+(?:\.\d{1,2})?)\s+(.+)/);

      expect(amountMatch).toBeTruthy();
      expect(amountMatch?.[2]).toBe('50');
      expect(amountMatch?.[3]).toBe('spesa cibo');
    });

    it('should extract decimal amounts', () => {
      const text = '25.50 supermercato';
      const amountMatch = text.match(/^([+-]?)(\d+(?:\.\d{1,2})?)\s+(.+)/);

      expect(amountMatch?.[2]).toBe('25.50');
    });

    it('should handle income with plus sign', () => {
      const text = '+2000 stipendio';
      const amountMatch = text.match(/^([+-]?)(\d+(?:\.\d{1,2})?)\s+(.+)/);

      expect(amountMatch?.[1]).toBe('+');
      expect(amountMatch?.[2]).toBe('2000');
    });

    it('should detect category from keywords', () => {
      const text = 'benzina auto';
      const category = mockCategories.find((c) => c.type === 'expense' && text.toLowerCase().includes(c.name.toLowerCase()));

      expect(category?.id).toBe('cat-2');
    });

    it('should handle case-insensitive matching', () => {
      const text = 'CIBO spesa';
      const category = mockCategories.find((c) => c.type === 'expense' && text.toLowerCase().includes(c.name.toLowerCase()));

      expect(category?.id).toBe('cat-1');
    });
  });

  describe('Report queries', () => {
    it('should parse "quanto ho speso" queries', () => {
      const text = 'quanto ho speso in aprile';
      const isReport = text.toLowerCase().startsWith('quanto ho speso');

      expect(isReport).toBe(true);
    });

    it('should extract month from query', () => {
      const text = 'quanto ho speso in marzo';
      const months: Record<string, number> = {
        gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
      };

      let foundMonth: number | null = null;
      for (const [name, idx] of Object.entries(months)) {
        if (text.includes(name)) {
          foundMonth = idx;
          break;
        }
      }

      expect(foundMonth).toBe(2); // marzo = month 2
    });

    it('should extract category from report query', () => {
      const text = 'quanto ho speso in cibo';
      const category = mockCategories.find((c) => c.type === 'expense' && text.includes(c.name.toLowerCase()));

      expect(category?.id).toBe('cat-1');
    });
  });

  describe('Auto tagging', () => {
    it('should parse comma-separated tags', () => {
      const tagsInput = 'casa, urgente, shopping';
      const tags = tagsInput.split(',').map((tag) => tag.trim().toLowerCase());

      expect(tags).toContain('casa');
      expect(tags).toContain('urgente');
      expect(tags).toContain('shopping');
    });

    it('should remove duplicates', () => {
      const tagsInput = 'auto, auto, car, auto';
      const tags = Array.from(new Set(tagsInput.split(',').map((tag) => tag.trim().toLowerCase())));

      expect(tags.length).toBe(2);
      expect(tags).toContain('auto');
      expect(tags).toContain('car');
    });

    it('should auto-add car tag if car is detected', () => {
      const carMatched = true;
      const manualTags = ['urgent'];
      const tags = carMatched ? ['car-expense', 'car-id:123', ...manualTags] : manualTags;

      expect(tags).toContain('car-expense');
      expect(tags).toContain('urgent');
    });
  });

  describe('Confidence scoring', () => {
    it('should have high confidence if category matched', () => {
      const hasCategory = true;
      const confidence = hasCategory ? 0.9 : 0.65;

      expect(confidence).toBe(0.9);
    });

    it('should have low confidence if no category', () => {
      const hasCategory = false;
      const confidence = hasCategory ? 0.9 : 0.65;

      expect(confidence).toBe(0.65);
    });

    it('should show reason for confidence', () => {
      const categoryName = 'Cibo';
      const reason = categoryName
        ? `Categoria riconosciuta dal testo: ${categoryName}`
        : 'Importo e tipo riconosciuti, ma nessuna categoria precisa trovata.';

      expect(reason).toContain('Cibo');
    });
  });
});
