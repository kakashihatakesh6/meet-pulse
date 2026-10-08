import {
  parseISO,
  differenceInMinutes,
  differenceInSeconds,
  isToday as dateFnsIsToday,
  isTomorrow as dateFnsIsTomorrow,
  isYesterday as dateFnsIsYesterday,
  addDays,
  startOfWeek,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { MeetingStatus } from '../types/meeting';
import { getDeviceTimezone, formatInTz } from './timezone';

/**
 * Formats time range e.g. "10:00 AM – 11:00 AM" or "All day"
 */
export function formatMeetingTime(
  startTimeIso: string,
  endTimeIso: string,
  timezone?: string,
  isAllDay: boolean = false
): string {
  if (isAllDay) {
    return 'All day';
  }

  const tz = timezone || getDeviceTimezone();
  const startStr = formatInTz(startTimeIso, 'h:mm a', tz);
  const endStr = formatInTz(endTimeIso, 'h:mm a', tz);

  return `${startStr} – ${endStr}`;
}

/**
 * Formats full friendly date e.g. "Today, Sep 25", "Tomorrow, Sep 26", or "Fri, Sep 25, 2026"
 */
export function formatMeetingDate(startTimeIso: string, timezone?: string): string {
  const tz = timezone || getDeviceTimezone();
  const startDate = parseISO(startTimeIso);

  if (dateFnsIsToday(startDate)) {
    return `Today, ${formatInTz(startTimeIso, 'MMM d', tz)}`;
  }
  if (dateFnsIsTomorrow(startDate)) {
    return `Tomorrow, ${formatInTz(startTimeIso, 'MMM d', tz)}`;
  }
  if (dateFnsIsYesterday(startDate)) {
    return `Yesterday, ${formatInTz(startTimeIso, 'MMM d', tz)}`;
  }

  return formatInTz(startTimeIso, 'EEE, MMM d, yyyy', tz);
}

/**
 * Formats relative time description e.g. "Starts in 15 mins", "In 2 hours", "In progress (ends in 10m)", "Ended 1 hour ago"
 */
export function getRelativeTimeLabel(
  startTimeIso: string,
  endTimeIso?: string
): { label: string; urgency: 'urgent' | 'soon' | 'upcoming' | 'in_progress' | 'past' } {
  const now = new Date();
  const start = parseISO(startTimeIso);
  const end = endTimeIso ? parseISO(endTimeIso) : undefined;

  const diffSecondsFromStart = differenceInSeconds(start, now);
  const diffMinutesFromStart = differenceInMinutes(start, now);

  // If in progress
  if (diffSecondsFromStart <= 0 && end && differenceInSeconds(end, now) > 0) {
    const remainingMins = differenceInMinutes(end, now);
    return {
      label: `In progress (ends in ${remainingMins}m)`,
      urgency: 'in_progress',
    };
  }

  // If past
  if (diffSecondsFromStart < 0) {
    const absMinutes = Math.abs(diffMinutesFromStart);
    if (absMinutes < 60) {
      return {
        label: `Ended ${absMinutes}m ago`,
        urgency: 'past',
      };
    }
    const hours = Math.floor(absMinutes / 60);
    return {
      label: `Ended ${hours}h ago`,
      urgency: 'past',
    };
  }

  // Future meetings
  if (diffMinutesFromStart === 0) {
    return {
      label: 'Starting right now',
      urgency: 'urgent',
    };
  }

  if (diffMinutesFromStart <= 15) {
    return {
      label: `Starts in ${diffMinutesFromStart}m`,
      urgency: 'urgent',
    };
  }

  if (diffMinutesFromStart <= 60) {
    return {
      label: `Starts in ${diffMinutesFromStart}m`,
      urgency: 'soon',
    };
  }

  if (diffMinutesFromStart < 1440) {
    const hours = Math.floor(diffMinutesFromStart / 60);
    const mins = diffMinutesFromStart % 60;
    return {
      label: mins > 0 ? `Starts in ${hours}h ${mins}m` : `Starts in ${hours}h`,
      urgency: 'upcoming',
    };
  }

  const days = Math.floor(diffMinutesFromStart / 1440);
  return {
    label: `In ${days} day${days > 1 ? 's' : ''}`,
    urgency: 'upcoming',
  };
}

/**
 * Calculates duration in minutes
 */
export function calculateDurationMinutes(startTimeIso: string, endTimeIso: string): number {
  try {
    const start = parseISO(startTimeIso);
    const end = parseISO(endTimeIso);
    const mins = differenceInMinutes(end, start);
    return mins > 0 ? mins : 0;
  } catch {
    return 0;
  }
}

/**
 * Formats duration number into clean string e.g. "30m", "1h", "1h 30m"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Computes the real-time status of a meeting
 */
export function computeMeetingStatus(
  startTimeIso: string,
  endTimeIso: string,
  savedStatus?: MeetingStatus
): MeetingStatus {
  if (savedStatus === 'cancelled') {
    return 'cancelled';
  }

  const now = new Date();
  const start = parseISO(startTimeIso);
  const end = parseISO(endTimeIso);

  if (now < start) {
    return 'upcoming';
  }
  if (now >= start && now <= end) {
    return 'in_progress';
  }
  return 'completed';
}

/**
 * Formats "Last synced 2 minutes ago", "Just now", etc.
 */
export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'Never synced';
  try {
    const date = parseISO(isoString);
    const now = new Date();
    const diffSeconds = differenceInSeconds(now, date);
    if (diffSeconds < 10) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = differenceInMinutes(now, date);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Gets dates for the week surrounding a base date
 */
export function getWeekDates(baseDate: Date = new Date(), timezone?: string): Date[] {
  const tz = timezone || getDeviceTimezone();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday start
  return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
}
