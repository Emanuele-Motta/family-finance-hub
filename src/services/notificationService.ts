// Author: Emanuele Motta
// Date: 16-Apr-2026
// Notifications service: manages intelligent push/telegram/email notifications
// Supports budget alerts, recurring reminders, anomalies, approvals

import type { 
  Notification,
  NotificationType,
  DeliveryChannel,
} from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';
import { formatDistance } from 'date-fns';
import { it } from 'date-fns/locale';

interface NotificationPayload {
  family_group_id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  delivery_channels: DeliveryChannel[];
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Creates and sends a notification
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<Notification> {
  // Create notification record
  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .insert({
      family_group_id: payload.family_group_id,
      user_id: payload.user_id,
      notification_type: payload.notification_type,
      title: payload.title,
      message: payload.message,
      delivery_channels: payload.delivery_channels,
      related_entity_type: payload.related_entity_type,
      related_entity_id: payload.related_entity_id,
      metadata: payload.metadata,
      status: 'queued',
    })
    .select()
    .single();

  if (notifError) throw notifError;

  const notif = notification as Notification;

  // Queue for delivery
  await queueNotificationDelivery(notif);

  return notif;
}

/**
 * Queues notification for delivery to various channels
 */
async function queueNotificationDelivery(notification: Notification): Promise<void> {
  // This would normally trigger Edge Function or background job
  // For now, we'll implement the queuing logic

  const deliveries = notification.delivery_channels.map(channel => ({
    notification_id: notification.id,
    channel,
    status: 'pending',
    created_at: new Date().toISOString(),
  }));

  // In production, this would enqueue to a message broker (Redis, RabbitMQ, etc.)
  // For now, we'll just log and schedule next delivery
  console.log('Queued notification deliveries:', deliveries);

  // Simulate scheduling delivery (would be in background job)
  if (notification.delivery_channels.includes('push')) {
    // Schedule push notification
  }
  if (notification.delivery_channels.includes('telegram')) {
    // Schedule Telegram message
  }
  if (notification.delivery_channels.includes('email')) {
    // Schedule email
  }
}

/**
 * Creates budget alert notification
 */
export async function notifyBudgetAlert(
  familyGroupId: string,
  userId: string,
  budgetName: string,
  spent: number,
  budget: number,
  percentUsed: number
): Promise<Notification> {
  const severity = percentUsed >= 100 ? '🚨' : percentUsed >= 90 ? '⚠️' : '📊';
  
  return sendNotification({
    family_group_id: familyGroupId,
    user_id: userId,
    notification_type: 'budget_alert',
    title: `${severity} Budget: ${budgetName}`,
    message:
      percentUsed >= 100
        ? `Hai superato il budget di €${(spent - budget).toFixed(2)}`
        : `Hai utilizzato il ${Math.round(percentUsed)}% del budget (€${spent.toFixed(2)} di €${budget.toFixed(2)})`,
    delivery_channels: ['push', 'email'],
    metadata: { spent, budget, percentUsed },
  });
}

/**
 * Creates recurring transaction reminder
 */
export async function notifyRecurrenceReminder(
  familyGroupId: string,
  userId: string,
  transactionName: string,
  daysUntil: number,
  amount: number
): Promise<Notification> {
  const when =
    daysUntil === 0
      ? 'oggi'
      : daysUntil === 1
        ? 'domani'
        : `tra ${daysUntil} giorni`;

  return sendNotification({
    family_group_id: familyGroupId,
    user_id: userId,
    notification_type: 'recurring_reminder',
    title: `📅 Reminder: ${transactionName}`,
    message: `Non dimenticare: ${transactionName} (€${amount.toFixed(2)}) è in scadenza ${when}`,
    delivery_channels: ['push', 'telegram'],
    metadata: { daysUntil, amount },
  });
}

/**
 * Creates anomaly alert
 */
export async function notifyAnomaly(
  familyGroupId: string,
  userId: string,
  anomalyDescription: string,
  severity: 'warning' | 'critical'
): Promise<Notification> {
  const emoji = severity === 'critical' ? '🚨' : '⚠️';
  return sendNotification({
    family_group_id: familyGroupId,
    user_id: userId,
    notification_type: 'anomaly',
    title: `${emoji} Transazione anomala rilevata`,
    message: anomalyDescription,
    delivery_channels: ['push', 'email'],
    metadata: { severity },
  });
}

/**
 * Creates approval request notification
 */
export async function notifyApprovalNeeded(
  familyGroupId: string,
  userId: string,
  requesterName: string,
  amount: number,
  reason?: string
): Promise<Notification> {
  return sendNotification({
    family_group_id: familyGroupId,
    user_id: userId,
    notification_type: 'approval_needed',
    title: '✅ Approvazione richiesta',
    message: `${requesterName} ha chiesto l'approvazione per una spesa di €${amount.toFixed(2)}${reason ? ': ' + reason : ''}`,
    delivery_channels: ['push', 'telegram'],
    metadata: { amount, requesterName },
  });
}

/**
 * Creates settlement reminder (who owes whom)
 */
export async function notifySettlementReminder(
  familyGroupId: string,
  userId: string,
  owedBy: string,
  amount: number,
  reason: string
): Promise<Notification> {
  return sendNotification({
    family_group_id: familyGroupId,
    user_id: userId,
    notification_type: 'settlement_reminder',
    title: '💳 Rimborso in sospeso',
    message: `${owedBy} ti deve €${amount.toFixed(2)} per: ${reason}`,
    delivery_channels: ['push', 'telegram'],
    metadata: { amount, owedBy },
  });
}

/**
 * Creates milestone notification (goal reached, etc.)
 */
export async function notifyMilestone(
  familyGroupId: string,
  userId: string,
  milestoneName: string
): Promise<Notification> {
  return sendNotification({
    family_group_id: familyGroupId,
    user_id: userId,
    notification_type: 'milestone',
    title: '🎉 Traguardo raggiunto!',
    message: `Congratulazioni! Hai raggiunto: ${milestoneName}`,
    delivery_channels: ['push', 'email'],
  });
}

/**
 * Gets unread notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly = false
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Notification[]) || [];
}

/**
 * Marks notification as read
 */
export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Marks all notifications as read
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

/**
 * Deletes a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Gets notification preferences for a user
 * (Would be stored in a user_preferences table in production)
 */
export function getDefaultNotificationChannels(
  notificationType: NotificationType
): DeliveryChannel[] {
  const defaults: Record<NotificationType, DeliveryChannel[]> = {
    budget_alert: ['push', 'email'],
    recurring_reminder: ['push', 'telegram'],
    anomaly: ['push', 'email'],
    approval_needed: ['push', 'telegram'],
    settlement_reminder: ['push', 'telegram'],
    milestone: ['push', 'email'],
  };

  return defaults[notificationType] || ['push'];
}

/**
 * Gets notification summary for dashboard
 */
export async function getNotificationSummary(userId: string): Promise<{
  unreadCount: number;
  recentNotifications: Notification[];
  byType: Record<NotificationType, number>;
}> {
  const notifications = await getUserNotifications(userId);
  const unreadCount = notifications.filter(n => !n.read_at).length;

  const byType: Record<NotificationType, number> = {
    budget_alert: 0,
    recurring_reminder: 0,
    anomaly: 0,
    approval_needed: 0,
    settlement_reminder: 0,
    milestone: 0,
  };

  notifications.forEach(n => {
    byType[n.notification_type]++;
  });

  return {
    unreadCount,
    recentNotifications: notifications.slice(0, 5),
    byType,
  };
}

/**
 * Batch send notifications to multiple users
 */
export async function broadcastNotification(
  familyGroupId: string,
  userIds: string[],
  payload: Omit<NotificationPayload, 'family_group_id' | 'user_id'>
): Promise<Notification[]> {
  const notifications: Notification[] = [];

  for (const userId of userIds) {
    try {
      const notif = await sendNotification({
        ...payload,
        family_group_id: familyGroupId,
        user_id: userId,
      });
      notifications.push(notif);
    } catch (error) {
      console.error(`Failed to send notification to user ${userId}:`, error);
    }
  }

  return notifications;
}

/**
 * Helper: Formats notification for display
 */
export function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  return formatDistance(date, new Date(), { addSuffix: true, locale: it });
}
