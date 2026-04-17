// Author: Emanuele Motta
// Date: 16-Apr-2026
// Analytics System - Track feature usage and user behavior
// NOTE: The `analytics_events` table does not exist in the current schema.
// All tracking calls are no-ops until the table is created. Read APIs return safe defaults.

export type EventType =
  | 'app_start'
  | 'auth_login'
  | 'auth_logout'
  | 'auth_signup'
  | 'transaction_created'
  | 'transaction_imported'
  | 'transaction_edited'
  | 'transaction_deleted'
  | 'bulk_action'
  | 'rule_created'
  | 'rule_applied'
  | 'recurring_created'
  | 'recurring_generated'
  | 'forecast_viewed'
  | 'anomaly_detected'
  | 'approval_requested'
  | 'approval_completed'
  | 'notification_sent'
  | 'export_generated'
  | 'feature_clicked'
  | 'error_occurred'
  | 'page_viewed';

interface AnalyticsEvent {
  event_type: EventType;
  user_id: string;
  family_group_id?: string;
  metadata?: Record<string, unknown>;
}

export async function trackEvent(_event: AnalyticsEvent): Promise<void> {
  // No-op: analytics_events table not yet provisioned.
}

export function useAnalytics() {
  const noop = () => {
    /* no-op */
  };
  return {
    trackPageView: noop as (pageName: string) => void,
    trackFeatureClick: noop as (featureName: string, context?: Record<string, unknown>) => void,
    trackTransaction: noop as (
      action: 'created' | 'imported' | 'edited' | 'deleted',
      transactionData?: Record<string, unknown>
    ) => void,
    trackImport: noop as (transactionCount: number, duplicateCount: number, rulesApplied: number) => void,
    trackBulkAction: noop as (action: string, count: number, context?: Record<string, unknown>) => void,
    trackRuleCreated: noop as (ruleName: string, conditionCount: number) => void,
    trackRecurringCreated: noop as (templateName: string, frequency: string, amount: number) => void,
    trackForecastViewed: noop as (interval: '30d' | '60d' | '90d') => void,
    trackAnomalyDetected: noop as (anomalyType: string, severity: 'info' | 'warning' | 'critical', amount: number) => void,
    trackError: noop as (errorMessage: string, errorCode?: string, context?: Record<string, unknown>) => void,
  };
}

export async function getAnalyticsSummary(_daysBack = 30) {
  return {
    totalEvents: 0,
    byEventType: {} as Record<EventType, number>,
    byDay: {} as Record<string, number>,
    averageEventsPerDay: 0,
  };
}

export async function getFeatureUsage(_featureName: string, _daysBack = 30) {
  return { totalClicks: 0, uniqueUsers: 0, averageClicksPerDay: 0 };
}

export async function getErrorRate(_daysBack = 7) {
  return { totalEvents: 0, totalErrors: 0, errorRate: 0 };
}
