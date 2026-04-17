// Author: Emanuele Motta
// Date: 16-Apr-2026
// Reconciliation service: automatic matching between imports and existing transactions
// Supports duplicate detection with configurable scoring

import type { 
  ImportPendingTransaction, 
  Transaction,
  Reconciliation 
} from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';

export interface MatchScore {
  total: number;
  dateMatch: number;
  amountMatch: number;
  descriptionMatch: number;
  accountMatch: number;
  details: {
    dateDaysDiff?: number;
    amountPercentDiff?: number;
    descriptionSimilarity?: number;
  };
}

// Reconciliation configuration
const CONFIG = {
  // Weights for scoring (0-1)
  weights: {
    date: 0.25,
    amount: 0.40,
    description: 0.25,
    account: 0.10,
  },
  // Thresholds
  thresholds: {
    matchConfident: 0.85,
    matchPossible: 0.70,
    duplicateWarning: 0.75,
  },
  // Settings
  dateToleranceDays: 5,
  amountTolerancePercent: 2,
  descriptionMinSimilarity: 0.6,
};

/**
 * Calculates string similarity using Levenshtein distance
 * Returns value between 0 and 1
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2[i - 1] === s1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * Calculates match score between import transaction and existing transaction
 */
export function calculateMatchScore(
  importTx: ImportPendingTransaction,
  existingTx: Transaction
): MatchScore {
  const details: MatchScore['details'] = {};

  // 1. Date match (within tolerance)
  const importDate = new Date(importTx.date).getTime();
  const existingDate = new Date(existingTx.date).getTime();
  const daysDiff = Math.abs(importDate - existingDate) / (1000 * 60 * 60 * 24);
  details.dateDaysDiff = daysDiff;
  const dateMatch =
    daysDiff <= CONFIG.dateToleranceDays
      ? 1 - daysDiff / CONFIG.dateToleranceDays
      : 0;

  // 2. Amount match (within tolerance)
  const amountDiff = Math.abs(
    Math.abs(importTx.amount) - Math.abs(existingTx.amount)
  );
  const amountPercent = (amountDiff / Math.abs(existingTx.amount)) * 100;
  details.amountPercentDiff = amountPercent;
  const amountMatch =
    amountPercent <= CONFIG.amountTolerancePercent
      ? 1 - amountPercent / (CONFIG.amountTolerancePercent * 2)
      : 0;

  // 3. Description match (fuzzy)
  const descriptionSimilarity = calculateStringSimilarity(
    importTx.description,
    existingTx.notes || ''
  );
  details.descriptionSimilarity = descriptionSimilarity;
  const descriptionMatch =
    descriptionSimilarity >= CONFIG.descriptionMinSimilarity
      ? descriptionSimilarity
      : 0;

  // 4. Account match
  const accountMatch =
    importTx.account_id && existingTx.account_id
      ? importTx.account_id === existingTx.account_id
        ? 1
        : 0
      : 0.5; // Neutral if account not set

  // Calculate weighted total
  const total =
    dateMatch * CONFIG.weights.date +
    amountMatch * CONFIG.weights.amount +
    descriptionMatch * CONFIG.weights.description +
    accountMatch * CONFIG.weights.account;

  return {
    total: Math.round(total * 100) / 100,
    dateMatch: Math.round(dateMatch * 100) / 100,
    amountMatch: Math.round(amountMatch * 100) / 100,
    descriptionMatch: Math.round(descriptionMatch * 100) / 100,
    accountMatch: Math.round(accountMatch * 100) / 100,
    details,
  };
}

/**
 * Finds potential matches for an imported transaction
 * Returns candidates sorted by score (highest first)
 */
export async function findPotentialMatches(
  importTx: ImportPendingTransaction,
  familyGroupId: string,
  limit = 3
): Promise<(Transaction & { matchScore: MatchScore })[]> {
  const { data: existingTransactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .order('date', { ascending: false })
    .limit(100); // Look at recent 100 transactions

  if (error) throw error;

  if (!existingTransactions || existingTransactions.length === 0) {
    return [];
  }

  const scored = existingTransactions.map(tx => ({
    ...tx,
    matchScore: calculateMatchScore(importTx, tx as Transaction),
  }));

  return scored
    .filter(tx => tx.matchScore.total >= CONFIG.thresholds.matchPossible)
    .sort((a, b) => b.matchScore.total - a.matchScore.total)
    .slice(0, limit);
}

/**
 * Performs automatic reconciliation for all pending transactions in a batch
 */
export async function reconcileImportBatch(
  importBatchId: string,
  familyGroupId: string,
  accountId: string
): Promise<{
  matched: number;
  duplicates: number;
  unmatched: number;
}> {
  // Get all pending transactions
  const { data: pendingTransactions, error: pendingError } = await supabase
    .from('import_pending_transactions')
    .select('*')
    .eq('import_batch_id', importBatchId)
    .eq('status', 'pending');

  if (pendingError) throw pendingError;

  if (!pendingTransactions || pendingTransactions.length === 0) {
    return { matched: 0, duplicates: 0, unmatched: 0 };
  }

  let matched = 0;
  let duplicates = 0;
  let unmatched = 0;

  for (const importTx of pendingTransactions as ImportPendingTransaction[]) {
    try {
      const matches = await findPotentialMatches(importTx, familyGroupId);

      if (matches.length === 0) {
        // No matches found
        unmatched++;
        await supabase
          .from('import_pending_transactions')
          .update({ status: 'pending' })
          .eq('id', importTx.id);
        continue;
      }

      const bestMatch = matches[0];

      if (bestMatch.matchScore.total >= CONFIG.thresholds.matchConfident) {
        // Confident match
        matched++;
        await Promise.all([
          supabase
            .from('import_pending_transactions')
            .update({
              status: 'matched',
              matched_transaction_id: bestMatch.id,
              duplicate_score: bestMatch.matchScore.total,
            })
            .eq('id', importTx.id),
          supabase
            .from('reconciliations')
            .insert({
              family_group_id: familyGroupId,
              import_transaction_id: importTx.id,
              matched_transaction_id: bestMatch.id,
              match_confidence: bestMatch.matchScore.total,
              match_method: 'auto',
              match_score_details: bestMatch.matchScore.details,
              is_duplicate: true,
            }),
        ]);
      } else if (bestMatch.matchScore.total >= CONFIG.thresholds.duplicateWarning) {
        // Warning - possible duplicate
        duplicates++;
        await supabase
          .from('import_pending_transactions')
          .update({
            status: 'duplicate_warning',
            matched_transaction_id: bestMatch.id,
            duplicate_score: bestMatch.matchScore.total,
          })
          .eq('id', importTx.id);
      } else {
        // Possible match but not confident enough
        unmatched++;
        await supabase
          .from('import_pending_transactions')
          .update({ status: 'pending' })
          .eq('id', importTx.id);
      }
    } catch (error) {
      console.error(`Error reconciling transaction ${importTx.id}:`, error);
      unmatched++;
    }
  }

  return { matched, duplicates, unmatched };
}

/**
 * Confirms a manual reconciliation match
 */
export async function confirmReconciliation(
  reconciliationId: string,
  confirmedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('reconciliations')
    .update({
      match_method: 'manual_confirm',
      confirmed_by: confirmedBy,
    })
    .eq('id', reconciliationId);

  if (error) throw error;
}

/**
 * Rejects a reconciliation match (marks as not duplicate)
 */
export async function rejectReconciliation(
  importTransactionId: string
): Promise<void> {
  const { error } = await supabase
    .from('import_pending_transactions')
    .update({
      status: 'manual_edit',
      matched_transaction_id: null,
      duplicate_score: null,
    })
    .eq('id', importTransactionId);

  if (error) throw error;
}

/**
 * Gets reconciliation statistics for a batch
 */
export async function getReconciliationStats(
  importBatchId: string
): Promise<{
  total: number;
  matched: number;
  duplicates: number;
  pending: number;
  reviewed: number;
}> {
  const { data: transactions, error } = await supabase
    .from('import_pending_transactions')
    .select('status')
    .eq('import_batch_id', importBatchId);

  if (error) throw error;

  const transactions_typed = transactions as ImportPendingTransaction[];

  return {
    total: transactions_typed.length,
    matched: transactions_typed.filter(t => t.status === 'matched').length,
    duplicates: transactions_typed.filter(
      t => t.status === 'duplicate_warning'
    ).length,
    pending: transactions_typed.filter(t => t.status === 'pending').length,
    reviewed: transactions_typed.filter(
      t => t.status !== 'pending' && t.status !== 'matched'
    ).length,
  };
}
