// Author: Emanuele Motta
// Date: 16-Apr-2026
// Recurring transactions service: advanced scheduling for recurring payments, subscriptions, and reminders
// Supports complex frequency patterns and smart date calculation

import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  setDate,
  isBefore,
  isAfter,
  format,
} from 'date-fns';
import type { 
  RecurringTemplate,
  RecurringOccurrence,
  RecurrenceFrequency,
  DayOfWeek,
  Transaction,
} from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';

type DateType = string | Date;

/**
 * Calculates next occurrence date based on frequency pattern
 */
export function calculateNextOccurrence(
  template: RecurringTemplate,
  lastDate: DateType
): Date {
  const last = typeof lastDate === 'string' ? new Date(lastDate) : lastDate;

  switch (template.frequency) {
    case 'daily':
      return addDays(last, template.interval);

    case 'weekly':
      return addDays(last, template.interval * 7);

    case 'biweekly':
      return addDays(last, 14);

    case 'monthly':
      return calculateMonthlyDate(last, template.day_of_month);

    case 'quarterly':
      return addMonths(last, 3 * template.interval);

    case 'yearly':
      return addYears(last, template.interval);

    default:
      throw new Error(`Unknown frequency: ${template.frequency}`);
  }
}

/**
 * Calculates date for monthly recurrence
 * Handles edge cases like end-of-month dates
 */
function calculateMonthlyDate(baseDate: Date, dayOfMonth?: number | null): Date {
  const nextMonth = addMonths(baseDate, 1);

  if (!dayOfMonth) {
    // Use same day of month as start date
    const startDate = new Date(baseDate);
    return setDate(nextMonth, startDate.getDate());
  }

  const lastDayOfMonth = endOfMonth(nextMonth).getDate();
  const targetDay = Math.min(dayOfMonth, lastDayOfMonth);
  return setDate(nextMonth, targetDay);
}

/**
 * Calculates all occurrences for a date range
 */
export function generateOccurrences(
  template: RecurringTemplate,
  startDate: DateType,
  endDate: DateType
): Date[] {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const templateStart = new Date(template.starts_at);
  const templateEnd = template.ends_at ? new Date(template.ends_at) : null;

  const occurrences: Date[] = [];
  let current = templateStart;
  let count = 0;

  while (isBefore(current, start)) {
    current = calculateNextOccurrence(template, current);
  }

  while (
    !isAfter(current, end) &&
    (!template.max_occurrences || count < template.max_occurrences)
  ) {
    const isWithinTemplateWindow = !isBefore(current, templateStart) && (!templateEnd || !isAfter(current, templateEnd));

    if (isWithinTemplateWindow) {
      occurrences.push(new Date(current));
      count++;
    }

    if (templateEnd && isAfter(current, templateEnd)) {
      break;
    }

    current = calculateNextOccurrence(template, current);
  }

  return occurrences;
}

/**
 * Creates a new recurring template
 */
export async function createRecurringTemplate(
  template: Omit<RecurringTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<RecurringTemplate> {
  const { data, error } = await supabase
    .from('recurring_templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;

  const created = data as unknown as RecurringTemplate;

  // Generate initial occurrences
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 365); // Next 365 days
  const occurrences = generateOccurrences(created, new Date(), futureDate);

  if (occurrences.length > 0) {
    const occurrenceData = occurrences.map(date => ({
      template_id: created.id,
      family_group_id: created.family_group_id,
      occurrence_date: format(date, 'yyyy-MM-dd'),
      status: 'pending',
    }));

    await supabase.from('recurring_occurrences').insert(occurrenceData);
  }

  return created;
}

/**
 * Updates a recurring template
 */
export async function updateRecurringTemplate(
  templateId: string,
  updates: Partial<RecurringTemplate>
): Promise<RecurringTemplate> {
  const { data, error } = await supabase
    .from('recurring_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as RecurringTemplate;
}

/**
 * Generates occurrences for a template
 */
export async function generateRecurringOccurrences(
  templateId: string,
  familyGroupId: string,
  daysAhead = 365
): Promise<RecurringOccurrence[]> {
  const { data: template, error: templateError } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError) throw templateError;

  const tmpl = template as unknown as RecurringTemplate;
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  const occurrences = generateOccurrences(tmpl, today, endDate);

  // Check existing occurrences
  const { data: existing } = await supabase
    .from('recurring_occurrences')
    .select('occurrence_date')
    .eq('template_id', templateId);

  const existingOccurrences = (existing as { occurrence_date: string }[] | null) || [];
  const existingDates = new Set(existingOccurrences.map((occurrence) => occurrence.occurrence_date));

  // Insert only new occurrences
  const newOccurrences = occurrences
    .filter(date => !existingDates.has(format(date, 'yyyy-MM-dd')))
    .map(date => ({
      template_id: templateId,
      family_group_id: familyGroupId,
      occurrence_date: format(date, 'yyyy-MM-dd'),
      status: 'pending',
    }));

  if (newOccurrences.length === 0) {
    return [];
  }

  const { data: inserted, error: insertError } = await supabase
    .from('recurring_occurrences')
    .insert(newOccurrences)
    .select();

  if (insertError) throw insertError;
  return ((inserted as unknown as RecurringOccurrence[]) || []);
}

/**
 * Creates an actual transaction from a recurring occurrence
 */
export async function createTransactionFromRecurrence(
  occurrenceId: string,
  userId: string
): Promise<Transaction> {
  // Get occurrence
  const { data: occurrence, error: occError } = await supabase
    .from('recurring_occurrences')
    .select('*, recurring_templates(*)')
    .eq('id', occurrenceId)
    .single();

  if (occError) throw occError;

  const occ = occurrence as unknown as RecurringOccurrence & { recurring_templates: RecurringTemplate };
  const template = occ.recurring_templates;

  // Create transaction
  const transactionData = {
    family_group_id: template.family_group_id,
    user_id: userId,
    created_by_user_id: userId,
    paid_by_user_id: userId,
    category_id: template.category_id,
    account_id: template.account_id,
    to_account_id: template.to_account_id,
    amount: template.amount,
    type: template.type,
    date: occ.occurrence_date,
    notes: template.description,
    tags: template.tags,
    recurring: true,
    recurrence_type: template.frequency === 'monthly' || template.frequency === 'yearly' ? template.frequency : null,
  };

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert(transactionData)
    .select()
    .single();

  if (txError) throw txError;

  // Update occurrence
  await supabase
    .from('recurring_occurrences')
    .update({
      transaction_id: transaction.id,
      status: 'completed',
    })
    .eq('id', occurrenceId);

  return transaction as Transaction;
}

/**
 * Gets pending occurrences for a date range
 */
export async function getPendingOccurrences(
  familyGroupId: string,
  fromDate: DateType,
  toDate: DateType
): Promise<(RecurringOccurrence & { template: RecurringTemplate })[]> {
  const from = typeof fromDate === 'string' ? fromDate : format(fromDate, 'yyyy-MM-dd');
  const to = typeof toDate === 'string' ? toDate : format(toDate, 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('recurring_occurrences')
    .select('*, recurring_templates(*)')
    .eq('family_group_id', familyGroupId)
    .eq('status', 'pending')
    .gte('occurrence_date', from)
    .lte('occurrence_date', to)
    .order('occurrence_date', { ascending: true });

  if (error) throw error;
  return ((data as unknown as (RecurringOccurrence & { template: RecurringTemplate })[]) || []);
}

/**
 * Gets upcoming reminders for a user
 */
export async function getUpcomingReminders(
  familyGroupId: string,
  daysAhead = 7
): Promise<
  (RecurringOccurrence & { template: RecurringTemplate; days_until: number })[]
> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const occurrences = await getPendingOccurrences(
    familyGroupId,
    today,
    futureDate
  );

  return occurrences
    .map(occ => ({
      ...occ,
      days_until: Math.ceil(
        (new Date(occ.occurrence_date).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    }))
    .filter(occ => occ.days_until <= daysAhead);
}

/**
 * Skips an occurrence
 */
export async function skipOccurrence(
  occurrenceId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('recurring_occurrences')
    .update({
      status: 'skipped',
      skip_reason: reason,
    })
    .eq('id', occurrenceId);

  if (error) throw error;
}

/**
 * Gets statistics for recurring transactions
 */
export async function getRecurringStats(
  familyGroupId: string
): Promise<{
  totalActive: number;
  monthlyProjected: number;
  nextOccurrences: RecurringOccurrence[];
}> {
  const { data: templates } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .eq('is_active', true);

  let monthlyProjected = 0;

  if (templates) {
    for (const t of templates as unknown as RecurringTemplate[]) {
      if (t.frequency === 'daily') {
        monthlyProjected += t.amount * 30;
      } else if (t.frequency === 'weekly') {
        monthlyProjected += (t.amount * 52) / 12;
      } else if (t.frequency === 'monthly') {
        monthlyProjected += t.amount;
      } else if (t.frequency === 'quarterly') {
        monthlyProjected += (t.amount * 4) / 12;
      } else if (t.frequency === 'yearly') {
        monthlyProjected += t.amount / 12;
      }
    }
  }

  const nextOccurrences = await getPendingOccurrences(
    familyGroupId,
    new Date(),
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  return {
    totalActive: templates?.length || 0,
    monthlyProjected: Math.round(monthlyProjected * 100) / 100,
    nextOccurrences: nextOccurrences.slice(0, 5),
  };
}

/**
 * Template helper: creates monthly recurrence
 */
export function createMonthlyTemplate(params: {
  familyGroupId: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  category_id: string;
  account_id: string;
  description: string;
  created_by: string;
}): Omit<RecurringTemplate, 'id' | 'created_at' | 'updated_at'> {
  return {
    family_group_id: params.familyGroupId,
    name: params.name,
    description: params.description,
    frequency: 'monthly',
    interval: 1,
    day_of_month: params.dayOfMonth,
    day_of_week: null,
    months: null,
    category_id: params.category_id,
    account_id: params.account_id,
    to_account_id: null,
    amount: params.amount,
    type: 'expense',
    tags: null,
    starts_at: format(new Date(), 'yyyy-MM-dd'),
    ends_at: null,
    max_occurrences: null,
    notify_days_before: null,
    notify_method: null,
    is_active: true,
    created_by: params.created_by,
  };
}

/**
 * Template helper: creates subscription template
 */
export function createSubscriptionTemplate(params: {
  familyGroupId: string;
  serviceName: string;
  amount: number;
  billingDay: number;
  category_id: string;
  account_id: string;
  created_by: string;
}): Omit<RecurringTemplate, 'id' | 'created_at' | 'updated_at'> {
  return {
    family_group_id: params.familyGroupId,
    name: `Subscription: ${params.serviceName}`,
    description: `${params.serviceName} subscription`,
    frequency: 'monthly',
    interval: 1,
    day_of_month: params.billingDay,
    day_of_week: null,
    months: null,
    category_id: params.category_id,
    account_id: params.account_id,
    to_account_id: null,
    amount: params.amount,
    type: 'expense',
    tags: ['subscription'],
    starts_at: format(new Date(), 'yyyy-MM-dd'),
    ends_at: null,
    max_occurrences: null,
    notify_days_before: 3,
    notify_method: 'all',
    is_active: true,
    created_by: params.created_by,
  };
}
