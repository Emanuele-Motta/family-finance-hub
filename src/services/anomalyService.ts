// Author: Emanuele Motta
// Date: 16-Apr-2026
// Anomaly detection service: identifies unusual transactions, spending patterns
// Uses statistical analysis and historical comparison

import type { 
  Transaction,
  Anomaly,
  AnomalyType,
  SeverityLevel,
} from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';

interface AnomalyAnalysis {
  anomalyType: AnomalyType;
  severity: SeverityLevel;
  description: string;
  confidence: number;
  analysis: Record<string, any>;
}

/**
 * Calculates statistical measures (mean, std dev) for historical transactions
 */
async function getHistoricalStats(
  familyGroupId: string,
  categoryId: string | null,
  daysBack = 90
): Promise<{
  mean: number;
  stdDev: number;
  max: number;
  min: number;
  count: number;
  median: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  let query = supabase
    .from('transactions')
    .select('amount')
    .eq('family_group_id', familyGroupId)
    .gte('date', startDate.toISOString().split('T')[0])
    .eq('type', 'expense');

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data: transactions, error } = await query;
  if (error) throw error;

  const txs = transactions as any[];
  if (txs.length === 0) {
    return { mean: 0, stdDev: 0, max: 0, min: 0, count: 0, median: 0 };
  }

  const amounts = txs.map(t => Math.abs(t.amount)).sort((a, b) => a - b);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const median = amounts[Math.floor(amounts.length / 2)];

  return {
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    max: amounts[amounts.length - 1],
    min: amounts[0],
    count: amounts.length,
    median,
  };
}

/**
 * Detects unusual amount compared to historical pattern
 */
export function detectUnusualAmount(
  transaction: Transaction,
  stats: Awaited<ReturnType<typeof getHistoricalStats>>
): AnomalyAnalysis | null {
  if (stats.count < 5) {
    // Not enough data
    return null;
  }

  const amount = Math.abs(transaction.amount);
  const zScore = (amount - stats.mean) / (stats.stdDev || stats.mean * 0.2);

  // Check if outlier (> 2.5 std dev from mean)
  if (Math.abs(zScore) > 2.5) {
    const percentAboveAvg = ((amount - stats.mean) / stats.mean) * 100;

    return {
      anomalyType: 'unusual_amount',
      severity: Math.abs(zScore) > 4 ? 'critical' : 'warning',
      description: `Importo inusualmente ${amount > stats.mean ? 'alto' : 'basso'}: € ${amount.toFixed(2)} (media: €${stats.mean.toFixed(2)})`,
      confidence: Math.min(0.99, 0.5 + Math.abs(zScore) / 10),
      analysis: {
        amount,
        mean: stats.mean,
        stdDev: stats.stdDev,
        zScore: Math.round(zScore * 100) / 100,
        percentAboveAvg: Math.round(percentAboveAvg * 100) / 100,
        historical: stats,
      },
    };
  }

  return null;
}

/**
 * Detects category mismatches based on pattern
 */
export function detectCategoryMismatch(
  transaction: Transaction,
  description: string,
  expectedCategory: string | null
): AnomalyAnalysis | null {
  if (!expectedCategory || !transaction.category_id) {
    return null;
  }

  if (transaction.category_id === expectedCategory) {
    return null;
  }

  // Known merchant patterns
  const patterns: Record<string, string[]> = {
    supermarket: ['coop', 'carrefour', 'esselunga', 'pam', 'sigma'],
    restaurant: ['ristorante', 'pizzeria', 'bar', 'trattoria'],
    gas: ['bp', 'shell', 'eni', 'q8', 'distributore'],
    pharmacy: ['farmacia'],
  };

  const descLower = description.toLowerCase();
  let detectedCategory = null;

  for (const [cat, keywords] of Object.entries(patterns)) {
    if (keywords.some(k => descLower.includes(k))) {
      detectedCategory = cat;
      break;
    }
  }

  if (detectedCategory) {
    return {
      anomalyType: 'unusual_category',
      severity: 'warning',
      description: `Categoria potenzialmente sbagliata. Rilevata categoria: ${detectedCategory}`,
      confidence: 0.7,
      analysis: {
        detectedCategory,
        currentCategory: transaction.category_id,
        description,
        keywords: patterns[detectedCategory],
      },
    };
  }

  return null;
}

/**
 * Detects potential duplicates
 */
export async function detectDuplicateLike(
  transaction: Transaction,
  familyGroupId: string,
  minutesWindow = 60
): Promise<AnomalyAnalysis | null> {
  const txDate = new Date(transaction.date);
  const windowStart = new Date(txDate.getTime() - minutesWindow * 60 * 1000);
  const windowEnd = new Date(txDate.getTime() + minutesWindow * 60 * 1000);

  const { data: similarTxs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .eq('account_id', transaction.account_id)
    .neq('id', transaction.id)
    .gte('date', windowStart.toISOString().split('T')[0])
    .lte('date', windowEnd.toISOString().split('T')[0]);

  if (error) throw error;

  const txs = similarTxs as Transaction[];
  const duplicateLike = txs.find(
    t =>
      Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 &&
      t.notes === transaction.notes
  );

  if (duplicateLike) {
    return {
      anomalyType: 'duplicate_like',
      severity: 'critical',
      description: `Transazione molto simile trovata il ${duplicateLike.date}`,
      confidence: 0.95,
      analysis: {
        duplicateId: duplicateLike.id,
        duplicateDate: duplicateLike.date,
        duplicateAmount: duplicateLike.amount,
      },
    };
  }

  return null;
}

/**
 * Calculates fraud score based on multiple factors
 */
export async function calculateFraudScore(
  transaction: Transaction,
  familyGroupId: string
): Promise<AnomalyAnalysis | null> {
  let score = 0;
  const factors: Record<string, number> = {};

  // Factor 1: Unusual amount
  try {
    const stats = await getHistoricalStats(familyGroupId, transaction.category_id);
    if (stats.count > 5) {
      const zScore = (Math.abs(transaction.amount) - stats.mean) / (stats.stdDev || 1);
      if (Math.abs(zScore) > 2) {
        factors['unusual_amount'] = Math.min(0.3, Math.abs(zScore) / 10);
        score += factors['unusual_amount'];
      }
    }
  } catch {
    // Skip if error
  }

  // Factor 2: Round number (potential fraud indicator)
  const amount = Math.abs(transaction.amount);
  if (amount % Math.floor(amount) === 0 && amount > 100) {
    factors['round_number'] = 0.1;
    score += 0.1;
  }

  // Factor 3: Large amount
  if (amount > 1000) {
    factors['large_amount'] = 0.15;
    score += 0.15;
  }

  // Factor 4: Weekend transaction
  const dayOfWeek = new Date(transaction.date).getDay();
  if (!transaction.notes && (dayOfWeek === 0 || dayOfWeek === 6)) {
    factors['weekend_no_notes'] = 0.1;
    score += 0.1;
  }

  if (score > 0.3) {
    return {
      anomalyType: 'fraud_score',
      severity: score > 0.5 ? 'critical' : 'warning',
      description: `Punteggio sospetto: ${(score * 100).toFixed(0)}% confidenza`,
      confidence: Math.min(0.9, score),
      analysis: {
        score,
        factors,
        amount,
      },
    };
  }

  return null;
}

/**
 * Analyzes a transaction for anomalies
 */
export async function analyzeTransaction(
  transaction: Transaction,
  familyGroupId: string,
  categoryId?: string | null
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    // 1. Check unusual amount
    const stats = await getHistoricalStats(familyGroupId, categoryId);
    const unusualAmount = detectUnusualAmount(transaction, stats);
    if (unusualAmount) {
      const { data: created } = await supabase
        .from('anomalies')
        .insert({
          family_group_id: familyGroupId,
          transaction_id: transaction.id,
          anomaly_type: unusualAmount.anomalyType,
          severity: unusualAmount.severity,
          description: unusualAmount.description,
          confidence: unusualAmount.confidence,
          analysis: unusualAmount.analysis,
        })
        .select()
        .single();

      if (created) anomalies.push(created as Anomaly);
    }

    // 2. Check duplicate-like
    const duplicateLike = await detectDuplicateLike(transaction, familyGroupId);
    if (duplicateLike) {
      const { data: created } = await supabase
        .from('anomalies')
        .insert({
          family_group_id: familyGroupId,
          transaction_id: transaction.id,
          anomaly_type: duplicateLike.anomalyType,
          severity: duplicateLike.severity,
          description: duplicateLike.description,
          confidence: duplicateLike.confidence,
          analysis: duplicateLike.analysis,
        })
        .select()
        .single();

      if (created) anomalies.push(created as Anomaly);
    }

    // 3. Check fraud score
    const fraudScore = await calculateFraudScore(transaction, familyGroupId);
    if (fraudScore && fraudScore.confidence > 0.4) {
      const { data: created } = await supabase
        .from('anomalies')
        .insert({
          family_group_id: familyGroupId,
          transaction_id: transaction.id,
          anomaly_type: fraudScore.anomalyType,
          severity: fraudScore.severity,
          description: fraudScore.description,
          confidence: fraudScore.confidence,
          analysis: fraudScore.analysis,
        })
        .select()
        .single();

      if (created) anomalies.push(created as Anomaly);
    }
  } catch (error) {
    console.error('Error analyzing transaction:', error);
  }

  return anomalies;
}

/**
 * Gets recent anomalies for a family
 */
export async function getRecentAnomalies(
  familyGroupId: string,
  limit = 20
): Promise<Anomaly[]> {
  const { data, error } = await supabase
    .from('anomalies')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .eq('is_acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Anomaly[]) || [];
}

/**
 * Acknowledges an anomaly
 */
export async function acknowledgeAnomaly(
  anomalyId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('anomalies')
    .update({
      is_acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', anomalyId);

  if (error) throw error;
}

/**
 * Gets anomaly summary for dashboard
 */
export async function getAnomalySummary(
  familyGroupId: string
): Promise<{
  totalUnacknowledged: number;
  criticalCount: number;
  warningCount: number;
  recentAnomalies: Anomaly[];
}> {
  const recent = await getRecentAnomalies(familyGroupId);

  return {
    totalUnacknowledged: recent.length,
    criticalCount: recent.filter(a => a.severity === 'critical').length,
    warningCount: recent.filter(a => a.severity === 'warning').length,
    recentAnomalies: recent.slice(0, 5),
  };
}
