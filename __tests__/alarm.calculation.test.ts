import { subMinutes, parseISO } from 'date-fns';
import { formatAlarmOffsetLabel } from '../constants/alarms';
import { AlarmService } from '../services/alarms/alarm.service';
import { Meeting } from '../types/meeting';

describe('Alarm Calculations & Notifications', () => {
  const mockMeeting: Meeting = {
    id: 'meet_123',
    calendarId: 'primary',
    title: 'Frontend Interview',
    startTime: '2026-09-25T14:00:00.000Z',
    endTime: '2026-09-25T15:00:00.000Z',
    timezone: 'UTC',
    platform: 'google_meet',
    attendees: [],
    source: 'google_calendar',
    status: 'upcoming',
    isAllDay: false,
    createdAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '2026-09-24T10:00:00.000Z',
  };

  describe('formatAlarmOffsetLabel', () => {
    it('formats offset presets accurately', () => {
      expect(formatAlarmOffsetLabel(0)).toBe('At meeting time');
      expect(formatAlarmOffsetLabel(5)).toBe('5 min before');
      expect(formatAlarmOffsetLabel(15)).toBe('15 min before');
      expect(formatAlarmOffsetLabel(30)).toBe('30 min before');
      expect(formatAlarmOffsetLabel(60)).toBe('1 hour before');
      expect(formatAlarmOffsetLabel(90)).toBe('1h 30m before');
      expect(formatAlarmOffsetLabel(120)).toBe('2 hours before');
    });
  });

  describe('buildNotificationContent', () => {
    it('generates correct titles based on offsetMinutes', () => {
      const atStart = AlarmService.buildAlarmContent(mockMeeting, 0);
      expect(atStart.title).toBe('⏰ Frontend Interview is starting now');

      const fifteenMin = AlarmService.buildAlarmContent(mockMeeting, 15);
      expect(fifteenMin.title).toBe('🔔 Frontend Interview starts in 15 minutes');

      const oneHour = AlarmService.buildAlarmContent(mockMeeting, 60);
      expect(oneHour.title).toBe('🔔 Frontend Interview starts in 1 hour');
    });

    it('calculates exact trigger timestamp', () => {
      const meetingStart = parseISO(mockMeeting.startTime);
      const trigger15 = subMinutes(meetingStart, 15);
      expect(trigger15.toISOString()).toBe('2026-09-25T13:45:00.000Z');

      const trigger30 = subMinutes(meetingStart, 30);
      expect(trigger30.toISOString()).toBe('2026-09-25T13:30:00.000Z');
    });
  });
});
