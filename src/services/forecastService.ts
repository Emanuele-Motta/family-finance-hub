// Author: Emanuele Motta
// Date: 16-Apr-2026
// Cashflow forecast service: predicts account balances 30/60/90 days ahead
// Uses recurring transactions, historical averages, and smart projections

import { 
  addDays, 
  format,
  startOfDay,
  startOfMonth,
  parseISO,
} from 'date-fns';
import type { 
  CashflowForecast,
  RecurringTemplate,
  Account,
} from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';
import { generateOccurrences } from './recurringService';

type ForecastDays = 30 | 60 | 90;

interface ForecastCalculation {
  projected_income: number;
  projected_expenses: number;
  forecast_balance: number;
  confidence_level: 'low' | 'medium' | 'high';
  calculation_method: 'recurring' | 'avg_historical' | 'combined';
  metadata: Record<string, any>;
}

/**
 * Calculates average daily spending/income from historical transactions
 */
export async function calculateHistoricalAverages(
  familyGroupId: string,
  accountId: string,
  daysBack = 90
): Promise<{
  avgDailyExpenses: number;
  avgDailyIncome: number;
  variance: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .eq('account_id', accountId)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lt('date', format(new Date(), 'yyyy-MM-dd'));

  if (error) throw error;

  const txs = transactions || [];
  const expenses = txs
    .filter(t => (t.type === 'expense' || t.type === 'transfer') && t.amount > 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const income = txs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const avgDailyExpenses = expenses / daysBack;
  const avgDailyIncome = income / daysBack;

  // Calculate variance (std dev)
  const dailyExpensesByDay: Record<string, number> = {};
  const dailyIncomeByDay: Record<string, number> = {};

  for (const tx of txs) {
    const key = tx.date;
    if (tx.type === 'expense' || tx.type === 'transfer') {
      dailyExpensesByDay[key] = (dailyExpensesByDay[key] || 0) + Math.abs(tx.amount);
    } else if (tx.type === 'income') {
      dailyIncomeByDay[key] = (dailyIncomeByDay[key] || 0) + Math.abs(tx.amount);
    }
  }

  const expenseValues = Object.values(dailyExpensesByDay);
  const avgExpense = expenseValues.reduce((a, b) => a + b, 0) / Math.max(expenseValues.length, 1);
  const variance =
    expenseValues.length > 0
      ? Math.sqrt(
          expenseValues.reduce((sum, val) => sum + Math.pow(val - avgExpense, 2), 0) /
            expenseValues.length
        )
      : 0;

  return {
    avgDailyExpenses,
    avgDailyIncome,
    variance,
  };
}

/**
 * Calculates projected income and expenses from recurring transactions
 */
export async function calculateRecurringProjection(
  familyGroupId: string,
  accountId: string,
  daysAhead: ForecastDays
): Promise<{
  projected_income: number;
  projected_expenses: number;
  confidence: number;
}> {
  const { data: templates, error: templatesError } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .eq('account_id', accountId)
    .eq('is_active', true);

  if (templatesError) throw templatesError;

  const tmplts = templates as RecurringTemplate[] || [];
  const endDate = addDays(startOfDay(new Date()), daysAhead);

  let projected_income = 0;
  let projected_expenses = 0;
  let occurrenceCount = 0;

  for (const template of tmplts) {
    const occurrences = generateOccurrences(
      template,
      new Date(),
      endDate
    );

    occurrenceCount += occurrences.length;

    if (template.type === 'income') {
      projected_income += template.amount * occurrences.length;
    } else if (template.type === 'expense' || template.type === 'transfer') {
      projected_expenses += Math.abs(template.amount) * occurrences.length;
    }
  }

  // Confidence is higher when we have recurring transactions
  const confidence = Math.min(0.9, tmplts.length * 0.2);

  return {
    projected_income,
    projected_expenses,
    confidence,
  };
}

/**
 * Calculates combined forecast using both historical and recurring
 */
export async function calculateCombinedForecast(
  familyGroupId: string,
  accountId: string,
  currentBalance: number,
  daysAhead: ForecastDays
): Promise<ForecastCalculation> {
  try {
    // Get historical averages
    const historical = await calculateHistoricalAverages(
      familyGroupId,
      accountId,
      90
    );

    // Get recurring projection
    const recurring = await calculateRecurringProjection(
      familyGroupId,
      accountId,
      daysAhead
    );

    // Weighted average: 60% recurring (more reliable), 40% historical
    const avgDailyIncome =
      recurring.projected_income / daysAhead * 0.6 +
      historical.avgDailyIncome * 0.4;
    const avgDailyExpenses =
      recurring.projected_expenses / daysAhead * 0.6 +
      historical.avgDailyExpenses * 0.4;

    const projected_income = Math.round(avgDailyIncome * daysAhead * 100) / 100;
    const projected_expenses = Math.round(avgDailyExpenses * daysAhead * 100) / 100;
    const net = projected_income - projected_expenses;
    const forecast_balance = Math.round((currentBalance + net) * 100) / 100;

    // Calculate confidence
    const hasRecurring = recurring.projected_income > 0 || recurring.projected_expenses > 0;
    const confidence_level: 'low' | 'medium' | 'high' = hasRecurring
      ? 'high'
      : historical.avgDailyExpenses > 0
        ? 'medium'
        : 'low';

    return {
      projected_income,
      projected_expenses,
      forecast_balance,
      confidence_level,
      calculation_method: 'combined',
      metadata: {
        historical,
        recurring,
        daysAhead,
      },
    };
  } catch (error) {
    // Fallback to recurring only
    const recurring = await calculateRecurringProjection(
      familyGroupId,
      accountId,
      daysAhead
    );

    const net = recurring.projected_income - recurring.projected_expenses;
    return {
      projected_income: recurring.projected_income,
      projected_expenses: recurring.projected_expenses,
      forecast_balance: Math.round((currentBalance + net) * 100) / 100,
      confidence_level: 'low',
      calculation_method: 'recurring',
      metadata: { error: String(error) },
    };
  }
}

/**
 * Generates forecast for an account
 */
export async function generateForecast(
  familyGroupId: string,
  accountId: string,
  daysAhead: ForecastDays = 30
): Promise<CashflowForecast> {
  // Get current account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (accountError) throw accountError;

  const acc = account as Account;
  const calc = await calculateCombinedForecast(
    familyGroupId,
    accountId,
    acc.balance,
    daysAhead
  );

  // Save forecast
  const { data: forecast, error: forecastError } = await supabase
    .from('cashflow_forecasts')
    .insert({
      family_group_id: familyGroupId,
      account_id: accountId,
      forecast_date: format(new Date(), 'yyyy-MM-dd'),
      forecast_days: daysAhead,
      current_balance: acc.balance,
      forecast_balance: calc.forecast_balance,
      projected_income: calc.projected_income,
      projected_expenses: calc.projected_expenses,
      confidence_level: calc.confidence_level,
      calculation_method: calc.calculation_method,
      metadata: calc.metadata,
    })
    .select()
    .single();

  if (forecastError) throw forecastError;
  return forecast as CashflowForecast;
}

/**
 * Generates forecasts for all accounts in a family
 */
export async function generateFamilyForecasts(
  familyGroupId: string,
  daysAhead: ForecastDays = 30
): Promise<CashflowForecast[]> {
  // Get all accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('family_group_id', familyGroupId);

  if (accountsError) throw accountsError;

  const forecasts: CashflowForecast[] = [];

  for (const account of accounts as Account[]) {
    try {
      const forecast = await generateForecast(
        familyGroupId,
        account.id,
        daysAhead
      );
      forecasts.push(forecast);
    } catch (error) {
      console.error(`Error generating forecast for account ${account.id}:`, error);
    }
  }

  return forecasts;
}

/**
 * Gets latest forecasts for an account (all intervals)
 */
export async function getLatestForecasts(
  familyGroupId: string,
  accountId: string
): Promise<Record<ForecastDays, CashflowForecast | null>> {
  const { data: forecasts, error } = await supabase
    .from('cashflow_forecasts')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) throw error;

  const fts = forecasts as CashflowForecast[];
  const result: Record<ForecastDays, CashflowForecast | null> = {
    30: null,
    60: null,
    90: null,
  };

  for (const forecast of fts) {
    if (forecast.forecast_days in result) {
      result[forecast.forecast_days as ForecastDays] = forecast;
    }
  }

  return result;
}

/**
 * Analyzes trend and gives warning if balance is projected negative
 */
export async function analyzeForecastRisk(
  familyGroupId: string,
  accountId: string
): Promise<{
  isAtRisk: boolean;
  severity: 'low' | 'medium' | 'high';
  message: string;
  projectedNegativeDate?: string;
}> {
  const forecasts = await getLatestForecasts(familyGroupId, accountId);
  const forecast30 = forecasts[30];

  if (!forecast30) {
    return {
      isAtRisk: false,
      severity: 'low',
      message: 'Nessun forecast disponibile',
    };
  }

  if (forecast30.forecast_balance < 0) {
    const dailyNet = (forecast30.projected_income - forecast30.projected_expenses) / 30;
    const daysToZero = Math.ceil(forecast30.current_balance / Math.abs(dailyNet));

    return {
      isAtRisk: true,
      severity: 'high',
      message: `Saldo negativo previsto tra ${daysToZero} giorni`,
      projectedNegativeDate: format(
        addDays(new Date(), Math.max(0, daysToZero)),
        'yyyy-MM-dd'
      ),
    };
  }

  if (forecast30.projected_expenses > forecast30.projected_income) {
    const dailyNet = (forecast30.projected_income - forecast30.projected_expenses) / 30;
    if (Math.abs(dailyNet) / forecast30.current_balance > 0.1) {
      return {
        isAtRisk: true,
        severity: 'medium',
        message: 'Spese supereranno le entrate nei prossimi 30 giorni',
      };
    }
  }

  return {
    isAtRisk: false,
    severity: 'low',
    message: 'Situazione stabile',
  };
}

/**
 * Gets comparison across all family accounts
 */
export async function getFamilyCashflowSummary(
  familyGroupId: string
): Promise<{
  totalCurrentBalance: number;
  totalProjected30d: number;
  totalProjected60d: number;
  totalProjected90d: number;
  familyTrend: 'positive' | 'neutral' | 'negative';
}> {
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('family_group_id', familyGroupId);

  if (accountsError) throw accountsError;

  const accs = accounts as Account[];
  let totalCurrentBalance = 0;
  let totalProjected30 = 0;
  let totalProjected60 = 0;
  let totalProjected90 = 0;

  for (const account of accs) {
    totalCurrentBalance += account.balance;

    const forecasts = await getLatestForecasts(familyGroupId, account.id);
    if (forecasts[30]) totalProjected30 += forecasts[30].forecast_balance;
    if (forecasts[60]) totalProjected60 += forecasts[60].forecast_balance;
    if (forecasts[90]) totalProjected90 += forecasts[90].forecast_balance;
  }

  const trend =
    totalProjected30 > totalCurrentBalance
      ? 'positive'
      : totalProjected30 < totalCurrentBalance * 0.95
        ? 'negative'
        : 'neutral';

  return {
    totalCurrentBalance,
    totalProjected30d: totalProjected30,
    totalProjected60d: totalProjected60,
    totalProjected90d: totalProjected90,
    familyTrend: trend,
  };
}
