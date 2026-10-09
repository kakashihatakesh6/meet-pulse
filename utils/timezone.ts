import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Returns the current device timezone string (e.g. "America/New_York", "Asia/Kolkata")
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Ensures an ISO 8601 string has a valid UTC offset or converts to UTC ISO string
 */
export function normalizeToUtcIso(dateInput: string | Date, fallbackTimezone?: string): string {
  if (dateInput instanceof Date) {
    return dateInput.toISOString();
  }

  const str = dateInput.trim();

  // If already full ISO with Z or offset (e.g., 2026-09-25T10:00:00Z or 2026-09-25T10:00:00+05:30)
  if (/Z|[+-]\d{2}:\d{2}$/.test(str)) {
    try {
      return parseISO(str).toISOString();
    } catch {
      return new Date(str).toISOString();
    }
  }

  // If date-only format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const tz = fallbackTimezone || getDeviceTimezone();
    const zonedDate = fromZonedTime(`${str}T00:00:00.000`, tz);
    return zonedDate.toISOString();
  }

  // If date-time format without offset e.g. YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
    const standardized = str.replace(' ', 'T');
    const tz = fallbackTimezone || getDeviceTimezone();
    const formatted = standardized.includes('.') ? standardized : `${standardized}.000`;
    const zonedDate = fromZonedTime(formatted, tz);
    return zonedDate.toISOString();
  }

  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // Fall through
  }

  throw new Error(`Unable to parse date string into UTC ISO: ${dateInput}`);
}

/**
 * Converts an all-day date range ("2026-09-25" -> "2026-09-26") to UTC start and end bounds
 * Google Calendar all-day events use inclusive start date and exclusive end date
 */
export function parseAllDayBounds(
  startDateStr: string,
  endDateStr?: string,
  timezone?: string
): { startIso: string; endIso: string } {
  const tz = timezone || getDeviceTimezone();
  const startZoned = fromZonedTime(`${startDateStr}T00:00:00.000`, tz);

  let endZoned: Date;
  if (endDateStr && endDateStr !== startDateStr) {
    // Google end date is exclusive (e.g. start: 2026-09-25, end: 2026-09-26 = 1 day)
    endZoned = fromZonedTime(`${endDateStr}T00:00:00.000`, tz);
  } else {
    // Single day: ends at 23:59:59.999
    endZoned = fromZonedTime(`${startDateStr}T23:59:59.999`, tz);
  }

  return {
    startIso: startZoned.toISOString(),
    endIso: endZoned.toISOString(),
  };
}

/**
 * Formats a UTC ISO timestamp into the specified timezone with format string
 */
export function formatInTz(
  isoDateString: string,
  formatPattern: string,
  targetTimezone?: string
): string {
  try {
    const tz = targetTimezone || getDeviceTimezone();
    const date = parseISO(isoDateString);
    return formatInTimeZone(date, tz, formatPattern);
  } catch (err) {
    try {
      return format(new Date(isoDateString), formatPattern);
    } catch {
      return isoDateString;
    }
  }
}

/**
 * Calculates start and end of day in a given timezone as UTC ISO strings
 */
export function getDayBoundariesInTz(
  date: Date = new Date(),
  timezone?: string
): { startIso: string; endIso: string } {
  const tz = timezone || getDeviceTimezone();
  const dateStr = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  const startZoned = fromZonedTime(`${dateStr}T00:00:00.000`, tz);
  const endZoned = fromZonedTime(`${dateStr}T23:59:59.999`, tz);

  return {
    startIso: startZoned.toISOString(),
    endIso: endZoned.toISOString(),
  };
}

/**
 * Calculates start and end of week (Monday 00:00:00 to Sunday 23:59:59.999) in a given timezone as UTC ISO strings
 */
export function getWeekBoundariesInTz(
  date: Date = new Date(),
  timezone?: string
): { startIso: string; endIso: string } {
  const tz = timezone || getDeviceTimezone();
  const dateStr = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  
  // startOfWeek Monday
  const dayOfWeek = localDate.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() + diffToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const mondayStr = format(monday, 'yyyy-MM-dd');
  const sundayStr = format(sunday, 'yyyy-MM-dd');

  const startZoned = fromZonedTime(`${mondayStr}T00:00:00.000`, tz);
  const endZoned = fromZonedTime(`${sundayStr}T23:59:59.999`, tz);

  return {
    startIso: startZoned.toISOString(),
    endIso: endZoned.toISOString(),
  };
}
