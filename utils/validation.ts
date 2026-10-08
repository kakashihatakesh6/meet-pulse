import { z } from 'zod';
import { parseISO, addMinutes, isValid } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { getDeviceTimezone } from './timezone';
import { identifyPlatform } from './meeting-url';

// ---------------------------------------------------------------------------
// Google Auth & User Schemas
// ---------------------------------------------------------------------------
export const GoogleUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  picture: z.string().url().optional(),
  verifiedEmail: z.boolean().optional(),
});

export const GoogleAuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  idToken: z.string().optional(),
  expiresIn: z.number().optional(),
  tokenType: z.string().optional(),
  scope: z.string().optional(),
  issuedAt: z.number(),
});

// ---------------------------------------------------------------------------
// Google Calendar API Schemas
// ---------------------------------------------------------------------------
export const GoogleCalendarListEntrySchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  primary: z.boolean().optional(),
  backgroundColor: z.string().optional(),
  foregroundColor: z.string().optional(),
  accessRole: z.string().optional(),
  timeZone: z.string().optional(),
  selected: z.boolean().optional(),
}).passthrough();

export const GoogleCalendarEventDateSchema = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
}).passthrough();

export const GoogleCalendarEventItemSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  htmlLink: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: GoogleCalendarEventDateSchema.optional(),
  end: GoogleCalendarEventDateSchema.optional(),
  endTimeUnspecified: z.boolean().optional(),
  recurrence: z.array(z.string()).optional(),
  recurringEventId: z.string().optional(),
  hangoutLink: z.string().optional(),
  conferenceData: z.any().optional(),
  organizer: z
    .object({
      email: z.string().optional(),
      displayName: z.string().optional(),
      self: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().optional(),
        displayName: z.string().optional(),
        responseStatus: z.string().optional(),
        self: z.boolean().optional(),
        organizer: z.boolean().optional(),
      }).passthrough()
    )
    .optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// App Settings Schema
// ---------------------------------------------------------------------------
export const AppSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  defaultAlarmOffsets: z.array(z.number()),
  enableMeetingTimeAlarm: z.boolean(),
  enableNotifications: z.boolean(),
  autoSyncOnAppOpen: z.boolean(),
  syncIntervalMinutes: z.number().min(5).max(1440),
  dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']),
  timeFormat: z.enum(['12h', '24h']),
  defaultTimezone: z.string(),
  defaultMeetingDurationMinutes: z.number().min(5).max(480),
  vibrationPatternEnabled: z.boolean(),
  highPriorityAlarms: z.boolean(),
});

// ---------------------------------------------------------------------------
// Spreadsheet Row & Date/Time Parsing Helpers
// ---------------------------------------------------------------------------

/**
 * Converts Excel serial date or general date/time strings into ISO format
 */
export function parseExcelSerialDate(serial: number): Date {
  // Excel base date is Dec 30, 1899 due to 1900 leap year bug
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const fractionalDay = serial - Math.floor(serial);
  let totalSeconds = Math.floor(86400 * fractionalDay);

  const seconds = totalSeconds % 60;
  totalSeconds = Math.floor(totalSeconds / 60);
  const minutes = totalSeconds % 60;
  const hours = Math.floor(totalSeconds / 60);

  const dateInfo = new Date(utcValue * 1000);
  return new Date(
    Date.UTC(
      dateInfo.getUTCFullYear(),
      dateInfo.getUTCMonth(),
      dateInfo.getUTCDate(),
      hours,
      minutes,
      seconds
    )
  );
}

/**
 * Normalizes duration string (e.g., "30", "30m", "45 mins", "1h", "1.5 hours") to minutes
 */
export function parseDurationToMinutes(durationInput?: unknown): number {
  if (typeof durationInput === 'number') {
    return durationInput > 0 ? durationInput : 30;
  }
  if (!durationInput || typeof durationInput !== 'string') {
    return 30;
  }

  const str = durationInput.trim().toLowerCase();
  // Format: "1.5h" or "1.5 hours"
  const hourMatch = str.match(/^([\d.]+)\s*(h|hr|hrs|hour|hours)$/);
  if (hourMatch) {
    return Math.round(parseFloat(hourMatch[1]) * 60);
  }

  // Format: "45m" or "45 mins" or plain "45"
  const minMatch = str.match(/^([\d.]+)\s*(m|min|mins|minute|minutes)?$/);
  if (minMatch) {
    return Math.round(parseFloat(minMatch[1]));
  }

  return 30;
}

/**
 * Parses time string (e.g. "10:30 AM", "14:30", "2:00 PM") into { hours: number, minutes: number }
 */
export function parseTimeString(timeInput: unknown): { hours: number; minutes: number } | null {
  if (typeof timeInput === 'number') {
    // If Excel serial fractional day (e.g., 0.4166667 for 10:00 AM)
    if (timeInput >= 0 && timeInput < 1) {
      const totalMinutes = Math.round(timeInput * 24 * 60);
      return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
      };
    }
    // If number representing hour e.g. 10 or 14
    if (timeInput >= 0 && timeInput <= 23) {
      return { hours: Math.floor(timeInput), minutes: 0 };
    }
  }

  if (typeof timeInput !== 'string') {
    return null;
  }

  const str = timeInput.trim();

  // 12-hour format with AM/PM (e.g., "10:30 AM", "2:15pm", "9:00AM")
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridian = ampmMatch[3].toUpperCase();

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }

  // 24-hour format (e.g., "14:30", "09:00", "14:30:00")
  const militaryMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (militaryMatch) {
    const hours = parseInt(militaryMatch[1], 10);
    const minutes = parseInt(militaryMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }

  return null;
}

/**
 * Parses date string (e.g., "2026-09-25", "09/25/2026", "25-09-2026", Excel serial 45558)
 * Returns { year, month (1-12), day }
 */
export function parseDateString(dateInput: unknown): { year: number; month: number; day: number } | null {
  if (typeof dateInput === 'number') {
    if (dateInput > 20000 && dateInput < 60000) {
      const d = parseExcelSerialDate(dateInput);
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
      };
    }
  }

  if (typeof dateInput !== 'string') {
    return null;
  }

  const str = dateInput.trim();

  // ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  // US Format: MM/DD/YYYY
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const p1 = parseInt(usMatch[1], 10);
    const p2 = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);

    // If first part > 12, it's definitely DD/MM/YYYY
    if (p1 > 12 && p2 <= 12) {
      return { year, month: p2, day: p1 };
    }
    // Default assume MM/DD/YYYY
    return { year, month: p1, day: p2 };
  }

  // European format: DD-MM-YYYY or DD.MM.YYYY
  const euMatch = str.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (euMatch) {
    return {
      year: parseInt(euMatch[3], 10),
      month: parseInt(euMatch[2], 10),
      day: parseInt(euMatch[1], 10),
    };
  }

  return null;
}

/**
 * Comprehensive parser that converts row date, start time, end time, and duration into validated UTC ISO strings
 */
export function validateAndBuildMeetingTimes(options: {
  dateValue: unknown;
  startTimeValue: unknown;
  endTimeValue?: unknown;
  durationValue?: unknown;
  timezone?: string;
  defaultDurationMinutes?: number;
}): {
  startIso: string;
  endIso: string;
  durationMinutes: number;
  errors: string[];
} {
  const errors: string[] = [];
  const tz = options.timezone || getDeviceTimezone();

  // If dateValue is already a full ISO timestamp with date + time
  if (
    typeof options.dateValue === 'string' &&
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(options.dateValue)
  ) {
    try {
      const fullDate = fromZonedTime(options.dateValue.replace(' ', 'T'), tz);
      if (isValid(fullDate)) {
        const duration = parseDurationToMinutes(options.durationValue) || options.defaultDurationMinutes || 30;
        const endIso = addMinutes(fullDate, duration).toISOString();
        return {
          startIso: fullDate.toISOString(),
          endIso,
          durationMinutes: duration,
          errors: [],
        };
      }
    } catch {
      // Fall through to separate parsing
    }
  }

  const parsedDate = parseDateString(options.dateValue);
  if (!parsedDate) {
    errors.push(`Invalid or missing meeting date: "${String(options.dateValue || '')}"`);
  }

  const parsedStartTime = parseTimeString(options.startTimeValue);
  if (!parsedStartTime) {
    errors.push(`Invalid or missing start time: "${String(options.startTimeValue || '')}"`);
  }

  if (!parsedDate || !parsedStartTime) {
    return {
      startIso: '',
      endIso: '',
      durationMinutes: 0,
      errors,
    };
  }

  // Construct start timestamp in target timezone
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${parsedDate.year}-${pad(parsedDate.month)}-${pad(parsedDate.day)}`;
  const timeStr = `${pad(parsedStartTime.hours)}:${pad(parsedStartTime.minutes)}:00`;
  const localDateTimeStr = `${dateStr}T${timeStr}.000Z`;

  let startDate: Date;
  try {
    startDate = fromZonedTime(localDateTimeStr, tz);
    if (!isValid(startDate)) {
      errors.push(`Constructed date is invalid: ${localDateTimeStr}`);
      return { startIso: '', endIso: '', durationMinutes: 0, errors };
    }
  } catch (err) {
    errors.push(`Failed to calculate timezone for date: ${String(err)}`);
    return { startIso: '', endIso: '', durationMinutes: 0, errors };
  }

  // Determine End Time
  let endDate: Date;
  let durationMinutes = options.defaultDurationMinutes || 30;

  const parsedEndTime = options.endTimeValue ? parseTimeString(options.endTimeValue) : null;
  if (parsedEndTime) {
    const endDateTimeStr = `${dateStr}T${pad(parsedEndTime.hours)}:${pad(parsedEndTime.minutes)}:00.000Z`;
    endDate = fromZonedTime(endDateTimeStr, tz);

    // If end time is earlier than start time, meeting crosses midnight into next day
    if (endDate <= startDate) {
      endDate = addMinutes(endDate, 24 * 60);
    }
    const diff = Math.round((endDate.getTime() - startDate.getTime()) / (60 * 1000));
    durationMinutes = diff > 0 ? diff : 30;
  } else if (options.durationValue) {
    durationMinutes = parseDurationToMinutes(options.durationValue);
    endDate = addMinutes(startDate, durationMinutes);
  } else {
    endDate = addMinutes(startDate, durationMinutes);
  }

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    durationMinutes,
    errors,
  };
}
