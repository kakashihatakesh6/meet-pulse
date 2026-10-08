import * as Notifications from 'expo-notifications';
import { PermissionStatus } from 'expo-modules-core';
import { Platform } from 'react-native';
import { logger } from '../../utils/logger';

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: PermissionStatus;
}

export async function checkNotificationPermissions(): Promise<NotificationPermissionStatus> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return {
      granted: settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
      canAskAgain: settings.canAskAgain,
      status: settings.status,
    };
  } catch (err) {
    logger.error('Failed to check notification permissions', err);
    return {
      granted: false,
      canAskAgain: true,
      status: PermissionStatus.UNDETERMINED,
    };
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== PermissionStatus.GRANTED) {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: true,
          allowCriticalAlerts: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== PermissionStatus.GRANTED) {
      logger.warn('Notification permissions were not granted by user');
      return false;
    }

    // On Android, set up high-priority channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meeting-high-priority-alarms', {
        name: 'Meeting High Priority Alarms',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250, 500, 250],
        lightColor: '#6366F1',
        sound: 'alarm.wav',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });

      await Notifications.setNotificationChannelAsync('meeting-standard-reminders', {
        name: 'Standard Meeting Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    logger.info('Notification permissions successfully granted and configured');
    return true;
  } catch (err) {
    logger.error('Error requesting notification permissions', err);
    return false;
  }
}
