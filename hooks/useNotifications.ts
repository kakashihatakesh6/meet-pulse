import { useEffect, useState, useCallback, useRef } from 'react';
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

  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);

  const checkPermissions = useCallback(async () => {
    try {
      const status = await checkNotificationPermissions();
      setPermissionStatus(status);
      return status;
    } catch (err) {
      logger.warn('Failed to check notification permissions', err);
      return null;
    }
  }, []);

  const requestPermissions = useCallback(async () => {
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
    // 1. Initialize notification system and check current permissions
    NotificationService.initialize().catch((err) =>
      logger.warn('Error during notification initialization', err)
    );
    checkPermissions().catch(() => {});

    // 2. Set up listener for when user interacts with / taps notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        logger.info('Notification response received by app', response.actionIdentifier);
        NotificationService.handleNotificationResponse(response, (meetingId) => {
          try {
            router.push({
              pathname: '/meeting/[id]',
              params: { id: meetingId },
            });
          } catch (navErr) {
            logger.error('Failed to navigate to meeting from notification', navErr);
          }
        });
      });

    // 3. Set up listener for foreground received notifications
    receivedListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        logger.info('Notification received while in foreground', notification.request.identifier);
      }
    );

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
      if (receivedListener.current) {
        receivedListener.current.remove();
      }
    };
  }, [checkPermissions, router]);

  return {
    permissionStatus,
    isGranted: permissionStatus?.granted ?? false,
    isRequesting,
    checkPermissions,
    requestPermissions,
  };
}
