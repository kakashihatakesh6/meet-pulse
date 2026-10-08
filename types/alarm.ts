import { Meeting } from './meeting';

export type AlarmStatus = 'pending' | 'triggered' | 'cancelled' | 'dismissed';

export interface Alarm {
  id: string; // Internal UUID
  meetingId: string; // Associated meeting UUID
  offsetMinutes: number; // 0 = At meeting time, 5 = 5 min before, 15 = 15 min before, etc.
  scheduledTime: string; // ISO 8601 UTC timestamp when notification will trigger
  notificationId?: string; // Identifier returned by Expo Notifications
  status: AlarmStatus;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlarmWithMeeting extends Alarm {
  meeting: Meeting;
}

export interface CreateAlarmInput {
  meetingId: string;
  offsetMinutes: number;
  scheduledTime?: string;
  notificationId?: string;
  isEnabled?: boolean;
}

export interface UpdateAlarmInput {
  id?: string;
  offsetMinutes?: number;
  scheduledTime?: string;
  notificationId?: string;
  status?: AlarmStatus;
  isEnabled?: boolean;
}

export interface ScheduledNotificationPayload {
  meetingId: string;
  meetingTitle: string;
  meetingUrl?: string;
  offsetMinutes: number;
  startTime: string;
}
