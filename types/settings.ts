export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemeMode;
  defaultAlarmOffsets: number[]; // e.g. [15, 0] = 15m before and at meeting time
  enableMeetingTimeAlarm: boolean;
  enableNotifications: boolean;
  autoSyncOnAppOpen: boolean;
  syncIntervalMinutes: number; // e.g. 15
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  timeFormat: '12h' | '24h';
  defaultTimezone: string;
  defaultMeetingDurationMinutes: number; // default 30 min if end time not provided in import
  vibrationPatternEnabled: boolean;
  highPriorityAlarms: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultAlarmOffsets: [10],
  enableMeetingTimeAlarm: true,
  enableNotifications: true,
  autoSyncOnAppOpen: true,
  syncIntervalMinutes: 15,
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '12h',
  defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  defaultMeetingDurationMinutes: 30,
  vibrationPatternEnabled: true,
  highPriorityAlarms: true,
};
