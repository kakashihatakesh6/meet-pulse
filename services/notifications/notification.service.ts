import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { subMinutes, parseISO, isFuture } from 'date-fns';
import { Meeting } from '../../types/meeting';
import { Alarm } from '../../types/alarm';
import { AlarmsRepository } from '../database/repositories/alarms.repository';
import { formatMeetingTime } from '../../utils/dates';
import { NOTIFICATION_CHANNELS, formatAlarmOffsetLabel } from '../../constants/alarms';
import { logger } from '../../utils/logger';

// Set up default foreground notification presentation options
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NOTIFICATION_CATEGORY_MEETING = 'MEETING_REMINDER_CATEGORY';

export const NotificationService = {
  /**
   * Initializes notification categories and action buttons
   */
  async initialize(): Promise<void> {
    try {
      await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_MEETING, [
        {
          identifier: 'JOIN_ACTION',
          buttonTitle: '🚀 Join Meeting',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'DISMISS_ACTION',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: true,
          },
        },
      ]);
      logger.info('Notification categories configured');
    } catch (err) {
      logger.warn('Failed to register notification category', err);
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
    } else if (offsetMinutes === 60) {
      title = `🔔 ${meeting.title} starts in 1 hour`;
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
   * Schedules a reliable local notification for a specific meeting alarm
   */
  async scheduleAlarmNotification(
    meeting: Meeting,
    offsetMinutes: number
  ): Promise<{ notificationId?: string; scheduledTime: string; isScheduled: boolean }> {
    const meetingStartDate = parseISO(meeting.startTime);
    const triggerDate = subMinutes(meetingStartDate, offsetMinutes);
    const scheduledTime = triggerDate.toISOString();

    // Do not schedule if trigger time is in past
    if (!isFuture(triggerDate)) {
      logger.info(
        `Trigger time for meeting "${meeting.title}" (-${offsetMinutes}m) is in the past. Skipping notification.`
      );
      return { scheduledTime, isScheduled: false };
    }

    const { title, body } = this.buildNotificationContent(meeting, offsetMinutes);

    try {
      const channelId =
        offsetMinutes === 0
          ? NOTIFICATION_CHANNELS.HIGH_PRIORITY_ALARMS
          : NOTIFICATION_CHANNELS.STANDARD_REMINDERS;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'alarm.wav',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: NOTIFICATION_CATEGORY_MEETING,
          data: {
            meetingId: meeting.id,
            meetingUrl: meeting.meetingUrl,
            title: meeting.title,
            offsetMinutes,
            startTime: meeting.startTime,
          },
        },
        trigger: {
          date: triggerDate,
          channelId,
        },
      });

      logger.info(
        `Scheduled alarm for "${meeting.title}" at ${triggerDate.toISOString()} (Notification ID: ${notificationId})`
      );

      return {
        notificationId,
        scheduledTime,
        isScheduled: true,
      };
    } catch (err) {
      logger.error(`Failed to schedule notification for "${meeting.title}"`, err);
      return { scheduledTime, isScheduled: false };
    }
  },

  /**
   * Cancels a specific scheduled notification by ID
   */
  async cancelNotification(notificationId?: string): Promise<void> {
    if (!notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      logger.info(`Cancelled scheduled notification ${notificationId}`);
    } catch (err) {
      logger.warn(`Could not cancel notification ${notificationId}`, err);
    }
  },

  /**
   * Schedules or updates alarms in SQLite and registers local OS notifications
   */
  async configureMeetingAlarms(
    meeting: Meeting,
    offsetMinutesList: number[]
  ): Promise<Alarm[]> {
    // 1. Get existing alarms for this meeting
    const existingAlarms = await AlarmsRepository.getByMeetingId(meeting.id);

    // 2. Cancel old OS notifications
    for (const oldAlarm of existingAlarms) {
      if (oldAlarm.notificationId) {
        await this.cancelNotification(oldAlarm.notificationId);
      }
    }

    // 3. Clear existing alarms in DB for clean replacement
    await AlarmsRepository.deleteByMeetingId(meeting.id);

    // 4. Schedule new notifications and insert into DB
    const createdAlarms: Alarm[] = [];
    for (const offset of offsetMinutesList) {
      const { notificationId, scheduledTime } = await this.scheduleAlarmNotification(
        meeting,
        offset
      );

      const savedAlarm = await AlarmsRepository.upsert({
        meetingId: meeting.id,
        offsetMinutes: offset,
        scheduledTime,
        notificationId,
        isEnabled: true,
      });

      createdAlarms.push(savedAlarm);
    }

    return createdAlarms;
  },

  /**
   * Reschedules alarms when a meeting start/end time is updated
   */
  async rescheduleMeetingAlarms(meeting: Meeting): Promise<void> {
    const existingAlarms = await AlarmsRepository.getByMeetingId(meeting.id);
    if (existingAlarms.length === 0) return;

    logger.info(`Rescheduling ${existingAlarms.length} alarms for meeting "${meeting.title}"`);
    for (const alarm of existingAlarms) {
      if (alarm.notificationId) {
        await this.cancelNotification(alarm.notificationId);
      }

      if (alarm.isEnabled && meeting.status !== 'cancelled') {
        const { notificationId, scheduledTime } = await this.scheduleAlarmNotification(
          meeting,
          alarm.offsetMinutes
        );

        await AlarmsRepository.update(alarm.id, {
          scheduledTime,
          notificationId,
          status: 'pending',
        });
      }
    }
  },

  /**
   * Cancels all notifications and alarms when a meeting is deleted or cancelled
   */
  async cancelAllAlarmsForMeeting(meetingId: string): Promise<void> {
    const alarms = await AlarmsRepository.getByMeetingId(meetingId);
    for (const alarm of alarms) {
      if (alarm.notificationId) {
        await this.cancelNotification(alarm.notificationId);
      }
    }
    await AlarmsRepository.deleteByMeetingId(meetingId);
  },

  /**
   * Handle notification response (user tapped notification or "Join Meeting" action)
   */
  handleNotificationResponse(
    response: Notifications.NotificationResponse,
    onNavigateToMeeting?: (meetingId: string) => void
  ): void {
    const data = response.notification.request.content.data as {
      meetingId?: string;
      meetingUrl?: string;
    };

    const actionId = response.actionIdentifier;

    if (actionId === 'JOIN_ACTION' && data?.meetingUrl) {
      Linking.openURL(data.meetingUrl).catch((err) =>
        logger.error('Failed to open meeting URL from notification action', err)
      );
      return;
    }

    if (data?.meetingUrl && actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // Prompt user or open
      if (onNavigateToMeeting && data.meetingId) {
        onNavigateToMeeting(data.meetingId);
      } else if (data.meetingUrl) {
        Linking.openURL(data.meetingUrl).catch(() => {});
      }
    } else if (data?.meetingId && onNavigateToMeeting) {
      onNavigateToMeeting(data.meetingId);
    }
  },
};
