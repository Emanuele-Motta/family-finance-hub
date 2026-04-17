// 16-Apr-2026 — Emanuele Motta
// Hook per sincronizzazione offline changes al riconnettersi

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { syncOfflineChanges, getOfflineChanges, type SyncResult } from '@/services/backupService';
import { toast } from 'sonner';

interface SyncState {
  isOnline: boolean;
  syncing: boolean;
  lastSync: string | null;
  syncResult: SyncResult | null;
}

/**
 * Hook che detecta la riconnessione e sincronizza offline changes
 */
export function useOfflineSync(refetchCallback?: () => Promise<void>) {
  const { currentFamilyGroupId } = useAppStore();
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncing: false,
    lastSync: null,
    syncResult: null,
  });

  const performSync = useCallback(async () => {
    if (!currentFamilyGroupId || syncState.syncing) return;

    const pendingChanges = getOfflineChanges();
    if (pendingChanges.length === 0) return;

    setSyncState((prev) => ({ ...prev, syncing: true }));

    try {
      const result = await syncOfflineChanges(currentFamilyGroupId);
      setSyncState((prev) => ({
        ...prev,
        syncing: false,
        lastSync: new Date().toISOString(),
        syncResult: result,
      }));

      if (result.status === 'completed') {
        toast.success(`${result.synced} sincronizzate`);
        if (refetchCallback) {
          await refetchCallback();
        }
      } else if (result.status === 'error') {
        toast.error(
          `${result.synced} sincronizzate, ${result.failed} errori. Riprova più tardi.`
        );
      }
    } catch (error) {
      setSyncState((prev) => ({ ...prev, syncing: false }));
      toast.error('Errore sincronizzazione');
      console.error('Sync error:', error);
    }
  }, [currentFamilyGroupId, syncState.syncing, refetchCallback]);

  // Detector reconnessione e sync automatico
  useEffect(() => {
    const handleOnline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: true }));
      performSync();
    };

    const handleOffline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync]);

  return syncState;
}
