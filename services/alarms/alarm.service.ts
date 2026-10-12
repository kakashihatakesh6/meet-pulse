import * as Linking from 'expo-linking';
import { subMinutes, parseISO, isFuture } from 'date-fns';
import { Meeting } from '../../types/meeting';
import { Alarm } from '../../types/alarm';
import { AlarmsRepository } from '../database/repositories/alarms.repository';
import { formatMeetingTime } from '../../utils/dates';
import { logger } from '../../utils/logger';

export const AlarmService = {
  /**
   * Builds user-friendly alarm title and body
   */
  buildAlarmContent(
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

  // Backwards compatibility alias
  buildNotificationContent(meeting: Meeting, offsetMinutes: number) {
    return this.buildAlarmContent(meeting, offsetMinutes);
  },

  /**
   * Calculates trigger time and prepares alarm record for a meeting
   */
  async scheduleAlarm(
    meeting: Meeting,
    offsetMinutes: number
  ): Promise<{ notificationId?: string; scheduledTime: string; isScheduled: boolean }> {
    const meetingStartDate = parseISO(meeting.startTime);
    const triggerDate = subMinutes(meetingStartDate, offsetMinutes);
    const scheduledTime = triggerDate.toISOString();

    // Do not schedule if trigger time is in past
    if (!isFuture(triggerDate)) {
      logger.info(
        `Trigger time for meeting "${meeting.title}" (-${offsetMinutes}m) is in the past. Skipping alarm.`
      );
      return { scheduledTime, isScheduled: false };
    }

    logger.info(
      `Alarm scheduled for "${meeting.title}" at ${triggerDate.toISOString()} (-${offsetMinutes}m)`
    );

    return {
      scheduledTime,
      isScheduled: true,
    };
  },

  // Backwards compatibility alias
  async scheduleAlarmNotification(meeting: Meeting, offsetMinutes: number) {
    return this.scheduleAlarm(meeting, offsetMinutes);
  },

  /**
   * Cancels a specific alarm by ID
   */
  async cancelAlarm(alarmId?: string): Promise<void> {
    if (!alarmId) return;
    logger.info(`Cancelled alarm ${alarmId}`);
  },

  // Backwards compatibility alias
  async cancelNotification(notificationId?: string) {
    return this.cancelAlarm(notificationId);
  },

  /**
   * Schedules or updates alarms in SQLite
   */
  async configureMeetingAlarms(
    meeting: Meeting,
    offsetMinutesList: number[]
  ): Promise<Alarm[]> {
    // 1. Clear existing alarms in DB for clean replacement
    await AlarmsRepository.deleteByMeetingId(meeting.id);

    // 2. Schedule alarms and insert into DB
    const createdAlarms: Alarm[] = [];
    for (const offset of offsetMinutesList) {
      const { scheduledTime } = await this.scheduleAlarm(
        meeting,
        offset
      );

      const savedAlarm = await AlarmsRepository.upsert({
        meetingId: meeting.id,
        offsetMinutes: offset,
        scheduledTime,
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
        const { scheduledTime } = await this.scheduleAlarm(
          meeting,
          alarm.offsetMinutes
        );

        await AlarmsRepository.update(alarm.id, {
          scheduledTime,
          status: 'pending',
        });
      }
    }
  },

  /**
   * Cancels all alarms when a meeting is deleted or cancelled
   */
  async cancelAllAlarmsForMeeting(meetingId: string): Promise<void> {
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

export const NotificationService = AlarmService;
