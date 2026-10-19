import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}

/**
 * Checks current notification permission status without prompting
 */
export async function checkNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const granted = window.Notification.permission === 'granted';
      return {
        granted,
        canAskAgain: window.Notification.permission === 'default',
        status: granted
          ? Notifications.PermissionStatus.GRANTED
          : Notifications.PermissionStatus.DENIED,
      };
    }
    return {
      granted: true,
      canAskAgain: false,
      status: Notifications.PermissionStatus.GRANTED,
    };
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    const granted =
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    return {
      granted,
      canAskAgain: settings.canAskAgain,
      status: settings.status,
    };
  } catch (err) {
    logger.warn('Failed to query notification permissions', err);
    return {
      granted: false,
      canAskAgain: true,
      status: Notifications.PermissionStatus.UNDETERMINED,
    };
  }
}

/**
 * Requests notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await window.Notification.requestPermission();
        return permission === 'granted';
      } catch (err) {
        logger.warn('Web notification permission request error', err);
        return false;
      }
    }
    return true;
  }

  try {
    const response = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
      android: {},
    });

    const granted =
      response.granted ||
      response.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      response.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    logger.info(`Notification permission request result: ${granted ? 'GRANTED' : 'DENIED'}`);
    return granted;
  } catch (err) {
    logger.error('Error requesting notification permissions', err);
    return false;
  }
}
