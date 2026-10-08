export interface AlarmPresetOption {
  label: string;
  shortLabel: string;
  minutes: number;
  description: string;
}

export const ALARM_PRESETS: AlarmPresetOption[] = [
  {
    label: 'At meeting time',
    shortLabel: '0 min (Event start)',
    minutes: 0,
    description: 'Triggers exactly at scheduled start time',
  },
  {
    label: '5 minutes before',
    shortLabel: '5 min before',
    minutes: 5,
    description: 'Quick heads-up to wrap up current task',
  },
  {
    label: '10 minutes before',
    shortLabel: '10 min before',
    minutes: 10,
    description: 'Time to prepare meeting notes',
  },
  {
    label: '15 minutes before',
    shortLabel: '15 min before',
    minutes: 15,
    description: 'Standard reminder to review agenda',
  },
  {
    label: '30 minutes before',
    shortLabel: '30 min before',
    minutes: 30,
    description: 'Early preparation window',
  },
  {
    label: '1 hour before',
    shortLabel: '1 hr before',
    minutes: 60,
    description: 'Major buffer for essential preparation',
  },
];

export const NOTIFICATION_CHANNELS = {
  HIGH_PRIORITY_ALARMS: 'meeting-high-priority-alarms',
  STANDARD_REMINDERS: 'meeting-standard-reminders',
};

export function formatAlarmOffsetLabel(minutes: number): string {
  if (minutes === 0) return 'At meeting time';
  if (minutes < 60) return `${minutes} min before`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} before`;
  }
  return `${hours}h ${remainingMinutes}m before`;
}
