import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  checkNotificationPermissions,
  requestNotificationPermissions,
  NotificationPermissionStatus,
} from '../services/notifications/notification.permissions';
import { NotificationService } from '../services/notifications/notification.service';
import { logger } from '../utils/logger';

export function useNotifications() {
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'web') {
      return { granted: false, canAskAgain: false, status: 'denied' as any };
    }
    const status = await checkNotificationPermissions();
    setPermissionStatus(status);
    return status;
  }, []);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'web') return false;
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermissions();
      await checkPermissions();
      return granted;
    } finally {
      setIsRequesting(false);
    }
  }, [checkPermissions]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // 1. Check initial permissions
    checkPermissions().catch(() => {});

    // 2. Initialize notification categories
    NotificationService.initialize().catch(() => {});

    // 3. Set up notification response listener (taps and actions)
    let responseSubscription: { remove: () => void } | undefined;
    try {
      responseSubscription =
        Notifications.addNotificationResponseReceivedListener((response) => {
          logger.info('Notification response received', response);
          NotificationService.handleNotificationResponse(
            response,
            (meetingId: string) => {
              router.push(`/meeting/${meetingId}`);
            }
          );
        });
    } catch (err) {
      logger.warn('Failed to add notification response listener', err);
    }

    return () => {
      if (responseSubscription?.remove) {
        responseSubscription.remove();
      }
    };
  }, [checkPermissions, router]);

  return {
    permissionStatus,
    isGranted: !!permissionStatus?.granted,
    isRequesting,
    checkPermissions,
    requestPermissions,
  };
}
