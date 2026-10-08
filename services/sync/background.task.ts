import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { BACKGROUND_SYNC_TASK_NAME } from '../../constants/storage';
import { CalendarSyncService } from './calendar.sync';
import { logger } from '../../utils/logger';

// Define the background task handler only on native platforms
if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
      logger.info('[BackgroundTask] Background sync task triggered by OS');

      try {
        const result = await CalendarSyncService.syncAllCalendars();

        if (result.success) {
          logger.info(
            `[BackgroundTask] Background sync succeeded (+${result.addedCount} / ~${result.updatedCount})`
          );
          return result.addedCount > 0 || result.updatedCount > 0
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;
        } else {
          logger.warn('[BackgroundTask] Background sync encountered issues', result.error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      } catch (err) {
        logger.error('[BackgroundTask] Unhandled error during background sync task', err);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch (err) {
    logger.warn('[BackgroundTask] Could not define background task', err);
  }
}

export const BackgroundSyncManager = {
  /**
   * Registers the background fetch task with the system
   */
  async registerBackgroundSync(intervalMinutes: number = 15): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);

      if (isRegistered) {
        logger.info('[BackgroundTask] Background sync task is already registered');
        return;
      }

      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
        minimumInterval: intervalMinutes * 60, // in seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });

      logger.info(
        `[BackgroundTask] Registered background sync task with interval: ${intervalMinutes}m`
      );
    } catch (err) {
      logger.warn('[BackgroundTask] Failed to register background sync task', err);
    }
  },

  /**
   * Unregisters the background sync task
   */
  async unregisterBackgroundSync(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
        logger.info('[BackgroundTask] Unregistered background sync task');
      }
    } catch (err) {
      logger.warn('[BackgroundTask] Failed to unregister background task', err);
    }
  },

  /**
   * Checks current task registration and status
   */
  async getStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
    if (Platform.OS === 'web') {
      return BackgroundFetch.BackgroundFetchStatus.Denied;
    }
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status ?? BackgroundFetch.BackgroundFetchStatus.Denied;
    } catch {
      return BackgroundFetch.BackgroundFetchStatus.Denied;
    }
  },
};
