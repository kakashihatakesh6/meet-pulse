import * as Linking from 'expo-linking';
import { Meeting } from '../../types/meeting';
import { Alarm } from '../../types/alarm';
import { AlarmsRepository } from '../database/repositories/alarms.repository';
import { NotificationService } from '../notifications/notification.service';
import { logger } from '../../utils/logger';

export const AlarmService = {
  /**
   * Builds user-friendly alarm title and body
   */
  buildAlarmContent(
    meeting: Meeting,
    offsetMinutes: number
  ): { title: string; body: string } {
    return NotificationService.buildNotificationContent(meeting, offsetMinutes);
  },

  // Backwards compatibility alias
  buildNotificationContent(meeting: Meeting, offsetMinutes: number) {
    return this.buildAlarmContent(meeting, offsetMinutes);
  },

  /**
   * Calculates trigger time and registers OS notification for an alarm
   */
  async scheduleAlarm(
    meeting: Meeting,
    offsetMinutes: number
  ): Promise<{ notificationId?: string; scheduledTime: string; isScheduled: boolean }> {
    return NotificationService.scheduleAlarmNotification(meeting, offsetMinutes);
  },

  // Backwards compatibility alias
  async scheduleAlarmNotification(meeting: Meeting, offsetMinutes: number) {
    return this.scheduleAlarm(meeting, offsetMinutes);
  },

  /**
   * Cancels a specific OS notification and alarm
   */
  async cancelAlarm(notificationId?: string): Promise<void> {
    if (!notificationId) return;
    await NotificationService.cancelNotification(notificationId);
  },

  // Backwards compatibility alias
  async cancelNotification(notificationId?: string) {
    return this.cancelAlarm(notificationId);
  },

  /**
   * Schedules or updates alarms in SQLite and registers OS notifications
   */
  async configureMeetingAlarms(
    meeting: Meeting,
    offsetMinutesList: number[]
  ): Promise<Alarm[]> {
    // 1. Cancel existing OS notifications and clear database records
    await this.cancelAllAlarmsForMeeting(meeting.id);

    // 2. Schedule new OS notifications and insert into DB
    const createdAlarms: Alarm[] = [];
    for (const offset of offsetMinutesList) {
      const { notificationId, scheduledTime } = await this.scheduleAlarm(
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
      if (alarm.isEnabled && meeting.status !== 'cancelled') {
        // Cancel previous OS notification
        if (alarm.notificationId) {
          await NotificationService.cancelNotification(alarm.notificationId);
        }

        // Schedule new OS notification with updated time
        const { notificationId, scheduledTime } = await this.scheduleAlarm(
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
   * Cancels all OS notifications and alarms when a meeting is deleted or cancelled
   */
  async cancelAllAlarmsForMeeting(meetingId: string): Promise<void> {
    const alarms = await AlarmsRepository.getByMeetingId(meetingId);
    for (const alarm of alarms) {
      if (alarm.notificationId) {
        await NotificationService.cancelNotification(alarm.notificationId);
      }
    }
    await AlarmsRepository.deleteByMeetingId(meetingId);
  },

  /**
   * Open meeting URL
   */
  async openMeeting(meetingUrl?: string): Promise<void> {
    if (meetingUrl) {
      Linking.openURL(meetingUrl).catch((err) =>
        logger.error('Failed to open meeting URL', err)
      );
    }
  },
};
