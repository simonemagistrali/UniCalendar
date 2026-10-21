import { useEffect, useState, useCallback, useRef } from 'react';
import { ankiService } from '../core/anki';
import { useAppStore } from '../store/useAppStore';
import { getEffectiveSpeed, estimateMinutes } from '../core/ankiStats';

const SYNC_INTERVAL_MS = 45 * 1000; // 45 secondi di polling leggero in background

export function useAnkiSync() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const preferences = useAppStore(s => s.preferences);
  const ankiHistory = useAppStore(s => s.ankiHistory);
  const recordAnkiSync = useAppStore(s => s.recordAnkiSync);

  const isSyncingRef = useRef(false);

  const syncNow = useCallback(async (): Promise<boolean> => {
    if (isSyncingRef.current) return isConnected ?? false;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const snapshotData = await ankiService.fetchFullSnapshot();
      if (!snapshotData) {
        setIsConnected(false);
        isSyncingRef.current = false;
        setIsSyncing(false);
        return false;
      }

      setIsConnected(true);
      setLastSyncTime(new Date());

      // Calcola la velocità effettiva (media 14gg -> collezione -> manuale)
      const speed = getEffectiveSpeed(ankiHistory, preferences);

      // Calcola il tempo necessario includendo sia le carte da ripassare che quelle nuove
      const estimatedMinutes = estimateMinutes(snapshotData.today, speed.seconds);

      const completeSnapshot = {
        ...snapshotData.today,
        estimatedMinutes,
        collectionAvgSeconds: snapshotData.collectionAvgSeconds ?? undefined,
      };

      // Salva nello store (e di conseguenza in localStorage e cloud Firebase)
      recordAnkiSync(completeSnapshot, snapshotData.reviewsByDay);

      isSyncingRef.current = false;
      setIsSyncing(false);
      return true;
    } catch {
      setIsConnected(false);
      isSyncingRef.current = false;
      setIsSyncing(false);
      return false;
    }
  }, [ankiHistory, preferences, recordAnkiSync, isConnected]);

  useEffect(() => {
    // Sincronizzazione iniziale
    syncNow();

    // Polling periodico in background
    const interval = setInterval(() => {
      syncNow();
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [syncNow]);

  return {
    isConnected,
    isSyncing,
    lastSyncTime,
    syncNow,
  };
}
