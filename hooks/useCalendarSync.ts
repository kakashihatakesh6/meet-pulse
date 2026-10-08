import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarSyncService } from '../services/sync/calendar.sync';
import { SyncRepository } from '../services/database/repositories/sync.repository';
import { useMeetingStore } from '../store/meeting.store';
import { formatTimeAgo } from '../utils/dates';
import { MEETINGS_QUERY_KEYS } from './useMeetings';
import { logger } from '../utils/logger';

export function useCalendarSync() {
  const queryClient = useQueryClient();
  const { isSyncing, setIsSyncing, lastSyncedTimestamp, setLastSyncedTimestamp } =
    useMeetingStore();
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load last sync timestamp on mount
  useEffect(() => {
    async function loadLastSync() {
      try {
        const metas = await SyncRepository.getAll();
        if (metas.length > 0) {
          // Sort by lastSyncTimestamp descending
          metas.sort(
            (a, b) =>
              new Date(b.lastSyncTimestamp).getTime() -
              new Date(a.lastSyncTimestamp).getTime()
          );
          setLastSyncedTimestamp(metas[0].lastSyncTimestamp);
        }
      } catch (err) {
        logger.warn('Failed to load initial sync metadata', err);
      }
    }
    loadLastSync();
  }, [setLastSyncedTimestamp]);

  const sync = useCallback(
    async (options: { forceFullSync?: boolean } = {}) => {
      setIsSyncing(true);
      setSyncError(null);

      try {
        const result = await CalendarSyncService.syncAllCalendars(options);

        if (result.success) {
          setLastSyncedTimestamp(result.syncTimestamp);
          // Invalidate and refetch all meetings queries to refresh UI instantly
          await queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEYS.all });
          await queryClient.refetchQueries({ queryKey: MEETINGS_QUERY_KEYS.all });
          logger.info('Calendar sync completed successfully');
          return result;
        } else {
          setSyncError(result.error || 'Failed to sync calendar');
          return result;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Synchronization failed';
        setSyncError(msg);
        logger.error('Sync error in hook', err);
        return {
          success: false,
          addedCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          alarmsScheduledCount: 0,
          syncTimestamp: new Date().toISOString(),
          error: msg,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [queryClient, setIsSyncing, setLastSyncedTimestamp]
  );

  const lastSyncedLabel = lastSyncedTimestamp
    ? `Last synced ${formatTimeAgo(lastSyncedTimestamp)}`
    : 'Not synced yet';

  return {
    sync,
    isSyncing,
    lastSyncedTimestamp,
    lastSyncedLabel,
    syncError,
  };
}
