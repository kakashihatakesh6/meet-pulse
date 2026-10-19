import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { subMinutes, parseISO, isFuture } from 'date-fns';
import { Meeting } from '../../types/meeting';
import { formatMeetingTime } from '../../utils/dates';
import { NOTIFICATION_CHANNELS } from '../../constants/alarms';
import { logger } from '../../utils/logger';

// Set up default foreground notification presentation options
if (typeof Notifications?.setNotificationHandler === 'function') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export const NOTIFICATION_CATEGORY_MEETING = 'MEETING_REMINDER_CATEGORY';
export const ACTION_JOIN = 'JOIN_ACTION';
export const ACTION_DISMISS = 'DISMISS_ACTION';

export const NotificationService = {
  /**
   * Initializes notification channels, categories and action buttons
   */
  async initialize(): Promise<void> {
    try {
      // 1. Configure Android Notification Channels with high priority & sound
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.HIGH_PRIORITY_ALARMS,
          {
            name: 'Meeting Alarms & Reminders',
            description: 'High-priority alarms and reminders for scheduled meetings',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'alarm.wav',
            vibrationPattern: [0, 500, 250, 500],
            lightColor: '#6366F1',
            enableLights: true,
            enableVibrate: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.ALARM,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            },
          }
        );

        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.STANDARD_UPDATES,
          {
            name: 'Meeting Schedule Updates',
            description: 'Notifications when meetings are rescheduled or cancelled',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            enableVibrate: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.NOTIFICATION,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            },
          }
        );
      }

      // 2. Configure Interactive Action Buttons on notifications
      if (Platform.OS !== 'web') {
        await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_MEETING, [
          {
            identifier: ACTION_JOIN,
            buttonTitle: '🚀 Join Meeting',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: ACTION_DISMISS,
            buttonTitle: 'Dismiss',
            options: {
              isDestructive: true,
            },
          },
        ]);
      }

      logger.info('NotificationService initialized with channels and action categories');
    } catch (err) {
      logger.warn('NotificationService initialization notice', err);
    }
  },

  /**
   * Builds user-friendly notification title and body
   */
  buildNotificationContent(
    meeting: Meeting,
    offsetMinutes: number
  ): { title: string; body: string } {
    let title: string;
    if (offsetMinutes === 0) {
      title = `⏰ ${meeting.title} is starting now`;
    } else if (offsetMinutes === 1) {
      title = `🔔 ${meeting.title} starts in 1 minute`;
    } else if (offsetMinutes === 60) {
      title = `🔔 ${meeting.title} starts in 1 hour`;
    } else if (offsetMinutes > 60 && offsetMinutes % 60 === 0) {
      title = `🔔 ${meeting.title} starts in ${offsetMinutes / 60} hours`;
    } else {
      title = `🔔 ${meeting.title} starts in ${offsetMinutes} minutes`;
    }

    const timeRange = formatMeetingTime(
      meeting.startTime,
      meeting.endTime,
      meeting.timezone,
      meeting.isAllDay
    );

    const parts: string[] = [timeRange];
    if (meeting.platform !== 'none' && meeting.platform !== 'other') {
      parts.push(meeting.platform.replace('_', ' ').toUpperCase());
    } else if (meeting.location) {
      parts.push(meeting.location);
    }

    return {
      title,
      body: parts.join(' • '),
    };
  },

  /**
   * Schedules a local notification at the exact trigger time
   */
  async scheduleAlarmNotification(
    meeting: Meeting,
    offsetMinutes: number
  ): Promise<{ notificationId?: string; scheduledTime: string; isScheduled: boolean }> {
    const meetingStartDate = parseISO(meeting.startTime);
    if (isNaN(meetingStartDate.getTime())) {
      logger.warn(`Invalid meeting start time for "${meeting.title}": ${meeting.startTime}`);
      return { scheduledTime: meeting.startTime, isScheduled: false };
    }

    const triggerDate = subMinutes(meetingStartDate, offsetMinutes);
    const scheduledTime = triggerDate.toISOString();

    // Check if trigger time is in the past
    if (!isFuture(triggerDate)) {
      logger.info(
        `Trigger time for "${meeting.title}" (-${offsetMinutes}m) is in the past. Skipping notification.`
      );
      return { scheduledTime, isScheduled: false };
    }

    const { title, body } = this.buildNotificationContent(meeting, offsetMinutes);

    let notificationId: string | undefined;
    try {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'alarm.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: NOTIFICATION_CATEGORY_MEETING,
          vibrate: [0, 500, 250, 500],
          color: '#6366F1',
          data: {
            meetingId: meeting.id,
            meetingUrl: meeting.meetingUrl,
            offsetMinutes,
            type: 'meeting_alarm',
          },
        },
        trigger: {
          date: triggerDate,
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          channelId: NOTIFICATION_CHANNELS.HIGH_PRIORITY_ALARMS,
        },
      });

      logger.info(
        `Scheduled notification for "${meeting.title}" at ${scheduledTime} (-${offsetMinutes}m, ID: ${notificationId})`
      );
    } catch (err) {
      logger.error(`Failed to schedule notification for "${meeting.title}"`, err);
    }

    return {
      notificationId,
      scheduledTime,
      isScheduled: !!notificationId,
    };
  },

  /**
   * Cancels a scheduled notification by ID
   */
  async cancelNotification(notificationId?: string): Promise<void> {
    if (!notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      logger.info(`Cancelled scheduled notification: ${notificationId}`);
    } catch (err) {
      logger.warn(`Failed to cancel notification ${notificationId}`, err);
    }
  },

  /**
   * Cancels all scheduled notifications
   */
  async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      logger.info('Cancelled all scheduled notifications');
    } catch (err) {
      logger.warn('Failed to cancel all scheduled notifications', err);
    }
  },

  /**
   * Retrieves all currently scheduled notification requests
   */
  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (err) {
      logger.warn('Failed to get scheduled notifications', err);
      return [];
    }
  },

  /**
   * Dismisses a delivered notification by ID from the notification tray
   */
  async dismissNotification(notificationId?: string): Promise<void> {
    if (!notificationId) return;
    try {
      await Notifications.dismissNotificationAsync(notificationId);
      logger.info(`Dismissed notification: ${notificationId}`);
    } catch (err) {
      logger.warn(`Failed to dismiss notification ${notificationId}`, err);
    }
  },

  /**
   * Dismisses all delivered notifications from the notification tray
   */
  async dismissAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      logger.info('Dismissed all notifications from tray');
    } catch (err) {
      logger.warn('Failed to dismiss all notifications', err);
    }
  },

  /**
   * Sends an immediate notification when a meeting is rescheduled
   */
  async sendMeetingRescheduledNotification(
    meeting: Meeting,
    oldStartTime?: string
  ): Promise<void> {
    try {
      const timeRange = formatMeetingTime(
        meeting.startTime,
        meeting.endTime,
        meeting.timezone,
        meeting.isAllDay
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📅 Meeting Rescheduled: ${meeting.title}`,
          body: `Moved to ${timeRange}. Your alarms have been automatically updated.`,
          sound: 'default',
          data: {
            meetingId: meeting.id,
            meetingUrl: meeting.meetingUrl,
            type: 'meeting_rescheduled',
          },
        },
        trigger:
          Platform.OS === 'android'
            ? { channelId: NOTIFICATION_CHANNELS.STANDARD_UPDATES }
            : null,
      });
      logger.info(`Sent rescheduled notification for "${meeting.title}"`);
    } catch (err) {
      logger.warn('Failed to send rescheduled notification', err);
    }
  },

  /**
   * Sends an immediate notification when a meeting is cancelled
   */
  async sendMeetingCancelledNotification(meetingTitle: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚫 Meeting Cancelled',
          body: `"${meetingTitle}" was cancelled by the organizer. Scheduled alarms were removed.`,
          sound: 'default',
          data: { type: 'meeting_cancelled' },
        },
        trigger:
          Platform.OS === 'android'
            ? { channelId: NOTIFICATION_CHANNELS.STANDARD_UPDATES }
            : null,
      });
      logger.info(`Sent cancelled notification for "${meetingTitle}"`);
    } catch (err) {
      logger.warn('Failed to send cancellation notification', err);
    }
  },

  /**
   * Schedules a test notification to fire in 2 seconds
   */
  async sendTestNotification(): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Test Alarm: Team Sync is starting now',
        body: 'Google Meet • 10:00 AM – 11:00 AM',
        sound: 'alarm.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: NOTIFICATION_CATEGORY_MEETING,
        vibrate: [0, 500, 250, 500],
        color: '#6366F1',
        data: { test: true },
      },
      trigger: {
        seconds: 2,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: NOTIFICATION_CHANNELS.HIGH_PRIORITY_ALARMS,
      },
    });
    logger.info(`Scheduled test notification ID: ${id}`);
    return id;
  },

  /**
   * Handles user tapping on a notification or an action button
   */
  handleNotificationResponse(
    response: Notifications.NotificationResponse,
    onNavigateToMeeting?: (meetingId: string) => void
  ): void {
    const data = response.notification.request.content.data as
      | {
          meetingId?: string;
          meetingUrl?: string;
          type?: string;
        }
      | undefined;

    const actionId = response.actionIdentifier;

    if (actionId === ACTION_DISMISS) {
      const notificationIdentifier = response.notification.request.identifier;
      if (notificationIdentifier) {
        Notifications.dismissNotificationAsync(notificationIdentifier).catch(() => {});
      }
      return;
    }

    if (actionId === ACTION_JOIN) {
      if (data?.meetingUrl) {
        Linking.openURL(data.meetingUrl).catch((err) =>
          logger.error('Failed to open meeting URL from notification action', err)
        );
      } else if (data?.meetingId && onNavigateToMeeting) {
        onNavigateToMeeting(data.meetingId);
      }
      return;
    }

    if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      if (data?.meetingId && onNavigateToMeeting) {
        onNavigateToMeeting(data.meetingId);
      } else if (data?.meetingUrl) {
        Linking.openURL(data.meetingUrl).catch((err) =>
          logger.error('Failed to open meeting URL from notification tap', err)
        );
      }
    }
  },
};
