// Author: Emanuele Motta
// Date: 16-Apr-2026
// Audit logging and versioning service: complete audit trail of all operations
// Tracks who did what when, with before/after snapshots

import type {
  AuditLog,
  RecordVersion,
  Transaction,
  Budget,
  Category,
  Profile,
} from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';

export type AuditableEntity = 'transaction' | 'budget' | 'category' | 'goal' | 'account' | 'recurring' | 'profile';

/**
 * Logs an audit event
 */
export async function logAuditEvent(
  familyGroupId: string,
  action: string,
  entityType: AuditableEntity,
  entityId: string | null = null,
  entityName: string | null = null,
  oldValues: Record<string, any> | null = null,
  newValues: Record<string, any> | null = null
): Promise<AuditLog> {
  const { data, error } = await supabase
    .rpc('log_audit_event', {
      _family_group_id: familyGroupId,
      _action: action,
      _entity_type: entityType,
      _entity_id: entityId,
      _entity_name: entityName,
      _old_values: oldValues,
      _new_values: newValues,
    });

  if (error) throw error;
  return data as unknown as AuditLog;
}

/**
 * Creates a version snapshot for a record
 */
export async function createRecordVersion(
  familyGroupId: string,
  recordType: AuditableEntity,
  recordId: string,
  data: Record<string, any>,
  changeReason?: string
): Promise<RecordVersion> {
  const { data: version, error } = await supabase
    .rpc('create_record_version', {
      _family_group_id: familyGroupId,
      _record_type: recordType,
      _record_id: recordId,
      _data: data,
      _change_reason: changeReason,
    });

  if (error) throw error;
  return version as unknown as RecordVersion;
}

/**
 * Gets audit log for an entity
 */
export async function getEntityAuditLog(
  entityType: AuditableEntity,
  entityId: string,
  limit = 50
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as AuditLog[]) || [];
}

/**
 * Gets full audit log for a family
 */
export async function getFamilyAuditLog(
  familyGroupId: string,
  filters?: {
    entityType?: AuditableEntity;
    userId?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
  },
  limit = 100
): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('family_group_id', familyGroupId);

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters?.action) {
    query = query.eq('action', filters.action);
  }

  if (filters?.fromDate) {
    query = query.gte('created_at', filters.fromDate);
  }

  if (filters?.toDate) {
    query = query.lte('created_at', filters.toDate);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as AuditLog[]) || [];
}

/**
 * Gets version history for a record
 */
export async function getRecordVersionHistory(
  recordType: AuditableEntity,
  recordId: string
): Promise<RecordVersion[]> {
  const { data, error } = await supabase
    .from('record_versions')
    .select('*')
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return (data as RecordVersion[]) || [];
}

/**
 * Gets a specific version of a record
 */
export async function getRecordVersion(
  recordType: AuditableEntity,
  recordId: string,
  versionNumber: number
): Promise<RecordVersion | null> {
  const { data, error } = await supabase
    .from('record_versions')
    .select('*')
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .eq('version_number', versionNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return (data as RecordVersion) || null;
}

/**
 * Compares two versions
 */
export function compareVersions(
  version1: RecordVersion,
  version2: RecordVersion
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};

  const allKeys = new Set([
    ...Object.keys(version1.data),
    ...Object.keys(version2.data),
  ]);

  for (const key of allKeys) {
    const val1 = version1.data[key];
    const val2 = version2.data[key];

    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      changes[key] = {
        old: val1,
        new: val2,
      };
    }
  }

  return changes;
}

/**
 * Helpers for common audit operations
 */

export const AuditHelpers = {
  /**
   * Logs transaction creation
   */
  logTransactionCreated: async (
    familyGroupId: string,
    transactionId: string,
    transaction: Record<string, any>
  ) => {
    await Promise.all([
      logAuditEvent(
        familyGroupId,
        'created',
        'transaction',
        transactionId,
        transaction.notes || 'Unnamed',
        null,
        transaction
      ),
      createRecordVersion(
        familyGroupId,
        'transaction',
        transactionId,
        transaction,
        'Creazione iniziale'
      ),
    ]);
  },

  /**
   * Logs transaction update
   */
  logTransactionUpdated: async (
    familyGroupId: string,
    transactionId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ) => {
    await Promise.all([
      logAuditEvent(
        familyGroupId,
        'updated',
        'transaction',
        transactionId,
        newValues.notes,
        oldValues,
        newValues
      ),
      createRecordVersion(
        familyGroupId,
        'transaction',
        transactionId,
        newValues,
        `Aggiornamento di: ${Object.keys(newValues).join(', ')}`
      ),
    ]);
  },

  /**
   * Logs transaction deletion
   */
  logTransactionDeleted: async (
    familyGroupId: string,
    transactionId: string,
    transaction: Record<string, any>
  ) => {
    await logAuditEvent(
      familyGroupId,
      'deleted',
      'transaction',
      transactionId,
      transaction.notes || 'Unnamed',
      transaction,
      null
    );
  },

  /**
   * Logs budget creation
   */
  logBudgetCreated: async (
    familyGroupId: string,
    budgetId: string,
    budget: Record<string, any>
  ) => {
    await Promise.all([
      logAuditEvent(
        familyGroupId,
        'created',
        'budget',
        budgetId,
        `Budget € ${budget.amount}`,
        null,
        budget
      ),
      createRecordVersion(familyGroupId, 'budget', budgetId, budget, 'Budget creato'),
    ]);
  },

  /**
   * Logs category creation
   */
  logCategoryCreated: async (
    familyGroupId: string,
    categoryId: string,
    category: Record<string, any>
  ) => {
    await logAuditEvent(
      familyGroupId,
      'created',
      'category',
      categoryId,
      category.name,
      null,
      category
    );
  },

  /**
   * Logs user profile update
   */
  logProfileUpdated: async (
    familyGroupId: string,
    userId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ) => {
    await logAuditEvent(
      familyGroupId,
      'updated',
      'profile',
      userId,
      newValues.display_name,
      oldValues,
      newValues
    );
  },
};

/**
 * Gets statistical summary of audit log
 */
export async function getAuditSummary(
  familyGroupId: string,
  daysBack = 30
): Promise<{
  totalEvents: number;
  byAction: Record<string, number>;
  byEntity: Record<string, number>;
  byUser: Record<string, number>;
  mostActiveDays: { date: string; count: number }[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('action, entity_type, user_id, created_at')
    .eq('family_group_id', familyGroupId)
    .gte('created_at', startDate.toISOString());

  if (error) throw error;

  const logs = data as Pick<AuditLog, 'action' | 'entity_type' | 'user_id' | 'created_at'>[] || [];

  const byAction: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byEntity[log.entity_type] = (byEntity[log.entity_type] || 0) + 1;
    if (log.user_id) {
      byUser[log.user_id] = (byUser[log.user_id] || 0) + 1;
    }

    const day = log.created_at.split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  }

  const mostActiveDays = Object.entries(byDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  return {
    totalEvents: logs.length,
    byAction,
    byEntity,
    byUser,
    mostActiveDays,
  };
}

/**
 * Exports audit log as CSV
 */
export async function exportAuditLogAsCSV(
  familyGroupId: string,
  filename = 'audit_log.csv'
): Promise<void> {
  const logs = await getFamilyAuditLog(familyGroupId, undefined, 1000);

  const headers = [
    'Data',
    'Utente',
    'Azione',
    'Entità',
    'ID',
    'Nome',
    'Vecchio valore',
    'Nuovo valore',
  ];

  const rows = logs.map(log => [
    log.created_at,
    log.user_id || 'Sistema',
    log.action,
    log.entity_type,
    log.entity_id || '',
    log.entity_name || '',
    JSON.stringify(log.old_values),
    JSON.stringify(log.new_values),
  ]);

  const csv =
    headers.join(',') +
    '\n' +
    rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
