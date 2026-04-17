// Author: Emanuele Motta
// Date: 16-Apr-2026
// Analytics System - Track feature usage and user behavior

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/types/supabase';

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
  metadata?: Record<string, any>;
  timestamp?: string;
  url?: string;
  user_agent?: string;
}

/**
 * Track analytics event
 */
export async function trackEvent(event: Omit<AnalyticsEvent, 'timestamp' | 'url' | 'user_agent'>) {
  try {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    // Store in analytics table (or use external service)
    await supabase.from('analytics_events').insert({
      event_type: fullEvent.event_type,
      user_id: fullEvent.user_id,
      family_group_id: fullEvent.family_group_id,
      metadata: fullEvent.metadata,
      created_at: fullEvent.timestamp,
    } as any);
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Silently fail - don't break user experience
  }
}

/**
 * React hook for analytics
 */
export function useAnalytics() {
  const trackPageView = (pageName: string) => {
    const user = getCurrentUser();
    if (user) {
      trackEvent({
        event_type: 'page_viewed',
        user_id: user.id,
        metadata: { page: pageName },
      });
    }
  };

  const trackFeatureClick = (featureName: string, context?: Record<string, any>) => {
    const user = getCurrentUser();
    if (user) {
      trackEvent({
        event_type: 'feature_clicked',
        user_id: user.id,
        metadata: { feature: featureName, ...context },
      });
    }
  };

  const trackTransaction = (
    action: 'created' | 'imported' | 'edited' | 'deleted',
    transactionData?: Record<string, any>
  ) => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    if (user) {
      const eventType: EventType =
        action === 'created'
          ? 'transaction_created'
          : action === 'imported'
            ? 'transaction_imported'
            : action === 'edited'
              ? 'transaction_edited'
              : 'transaction_deleted';

      trackEvent({
        event_type: eventType,
        user_id: user.id,
        family_group_id: familyGroupId,
        metadata: {
          amount: transactionData?.amount,
          category: transactionData?.category,
          type: transactionData?.type,
        },
      });
    }
  };

  const trackImport = (
    transactionCount: number,
    duplicateCount: number,
    rulesApplied: number
  ) => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    if (user) {
      trackEvent({
        event_type: 'transaction_imported',
        user_id: user.id,
        family_group_id: familyGroupId,
        metadata: {
          transaction_count: transactionCount,
          duplicate_count: duplicateCount,
          rules_applied: rulesApplied,
        },
      });
    }
  };

  const trackBulkAction = (
    action: string,
    count: number,
    context?: Record<string, any>
  ) => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    if (user) {
      trackEvent({
        event_type: 'bulk_action',
        user_id: user.id,
        family_group_id: familyGroupId,
        metadata: {
          action,
          count,
          ...context,
        },
      });
    }
  };

  const trackRuleCreated = (ruleName: string, conditionCount: number) => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    if (user) {
      trackEvent({
        event_type: 'rule_created',
        user_id: user.id,
        family_group_id: familyGroupId,
        metadata: {
          rule_name: ruleName,
          condition_count: conditionCount,
        },
      });
    }
  };

  const trackRecurringCreated = (
    templateName: string,
    frequency: string,
    amount: number
  ) => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    if (user) {
      trackEvent({
        event_type: 'recurring_created',
        user_id: user.id,
        family_group_id: familyGroupId,
        metadata: {
          template_name: templateName,
          frequency,
          amount,
        },
      });
    }
  };

  const trackForecastViewed = (interval: '30d' | '60d' | '90d') => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    if (user) {
      trackEvent({
        event_type: 'forecast_viewed',
        user_id: user.id,
        family_group_id: familyGroupId,
        metadata: { interval },
      });
    }
  };

  const trackAnomalyDetected = (
    anomalyType: string,
    severity: 'info' | 'warning' | 'critical',
    amount: number
  ) => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    if (user) {
      trackEvent({
        event_type: 'anomaly_detected',
        user_id: user.id,
        family_group_id: familyGroupId,
        metadata: {
          anomaly_type: anomalyType,
          severity,
          amount,
        },
      });
    }
  };

  const trackError = (errorMessage: string, errorCode?: string, context?: Record<string, any>) => {
    const user = getCurrentUser();
    const familyGroupId = getFamilyGroupId();

    trackEvent({
      event_type: 'error_occurred',
      user_id: user?.id || 'unknown',
      family_group_id: familyGroupId,
      metadata: {
        error_message: errorMessage,
        error_code: errorCode,
        ...context,
      },
    });
  };

  return {
    trackPageView,
    trackFeatureClick,
    trackTransaction,
    trackImport,
    trackBulkAction,
    trackRuleCreated,
    trackRecurringCreated,
    trackForecastViewed,
    trackAnomalyDetected,
    trackError,
  };
}

/**
 * Helper functions
 */

function getCurrentUser() {
  // In a real app, get from auth context
  try {
    const { data } = supabase.auth.getSession();
    return data.session?.user;
  } catch {
    return null;
  }
}

function getFamilyGroupId(): string | undefined {
  // In a real app, get from app store/context
  // For now, return undefined
  return undefined;
}

/**
 * Analytics Dashboard queries
 */

export async function getAnalyticsSummary(daysBack = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type, created_at')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const events = data || [];

    // Group by event type
    const byEventType: Record<EventType, number> = {} as Record<EventType, number>;
    const byDay: Record<string, number> = {};

    for (const event of events) {
      byEventType[event.event_type as EventType] =
        (byEventType[event.event_type as EventType] || 0) + 1;

      const day = event.created_at.split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }

    return {
      totalEvents: events.length,
      byEventType,
      byDay,
      averageEventsPerDay: events.length / daysBack,
    };
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return null;
  }
}

export async function getFeatureUsage(featureName: string, daysBack = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('analytics_events')
      .select('user_id, created_at, metadata')
      .eq('event_type', 'feature_clicked')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const events = (data || []).filter(
      e => e.metadata && e.metadata.feature === featureName
    );

    return {
      totalClicks: events.length,
      uniqueUsers: new Set(events.map(e => e.user_id)).size,
      averageClicksPerDay: events.length / daysBack,
    };
  } catch (error) {
    console.error('Error fetching feature usage:', error);
    return null;
  }
}

export async function getErrorRate(daysBack = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type, created_at')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const events = data || [];
    const errors = events.filter(e => e.event_type === 'error_occurred');

    return {
      totalEvents: events.length,
      totalErrors: errors.length,
      errorRate: (errors.length / events.length) * 100,
    };
  } catch (error) {
    console.error('Error fetching error rate:', error);
    return null;
  }
}

/**
 * Example usage in components:
 *
 * ```tsx
 * import { useAnalytics } from '@/monitoring/analytics';
 *
 * export function TransactionForm() {
 *   const { trackTransaction, trackError } = useAnalytics();
 *
 *   const handleSubmit = async (formData) => {
 *     try {
 *       await createTransaction(formData);
 *       trackTransaction('created', formData);
 *     } catch (error) {
 *       trackError(error.message, 'TRANSACTION_CREATE_FAILED');
 *     }
 *   };
 * }
 * ```
 */
