import {
  ColumnMapping,
  SpreadsheetRow,
  ParsedMeetingRow,
  ImportRowStatus,
} from '../../types/import';
import { CreateMeetingInput } from '../../types/meeting';
import {
  validateAndBuildMeetingTimes,
  parseDurationToMinutes,
} from '../../utils/validation';
import { extractMeetingLink, identifyPlatform } from '../../utils/meeting-url';
import { getDeviceTimezone } from '../../utils/timezone';

const COLUMN_SYNONYMS = {
  title: [
    'meeting',
    'title',
    'meeting name',
    'meeting title',
    'subject',
    'event',
    'event name',
    'summary',
    'topic',
    'name',
    'session',
    'session title',
  ],
  date: [
    'date',
    'meeting date',
    'start date',
    'event date',
    'day',
    'scheduled date',
  ],
  startTime: [
    'start time',
    'start',
    'time',
    'start_time',
    'begin',
    'begin time',
    'from',
    'starts at',
  ],
  endTime: [
    'end time',
    'end',
    'end_time',
    'finish',
    'finish time',
    'to',
    'ends at',
  ],
  duration: [
    'duration',
    'duration (mins)',
    'length',
    'mins',
    'minutes',
    'duration_minutes',
  ],
  meetingUrl: [
    'meeting link',
    'meeting url',
    'link',
    'url',
    'zoom link',
    'meet link',
    'teams link',
    'join url',
    'join link',
    'video link',
    'conference link',
  ],
  description: [
    'description',
    'notes',
    'agenda',
    'details',
    'body',
    'comment',
    'comments',
    'summary details',
  ],
  location: ['location', 'room', 'venue', 'place', 'address', 'room number'],
  alarmOffset: [
    'alarm',
    'reminder',
    'alert',
    'notify',
    'alarm (mins)',
    'reminder (mins)',
    'notification',
  ],
  organizerName: [
    'organizer',
    'organizer name',
    'host',
    'host name',
    'chair',
    'lead',
    'presenter',
  ],
  organizerEmail: ['organizer email', 'host email', 'email', 'organizer_email'],
};

/**
 * Fuzzy matches an array of headers to find the best match for a given field key
 */
function findBestHeaderMatch(headers: string[], synonyms: string[]): string {
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: h.trim().toLowerCase().replace(/[^a-z0-9]/g, ' '),
  }));

  // 1. Check exact match
  for (const syn of synonyms) {
    const found = normalizedHeaders.find((h) => h.normalized === syn);
    if (found) return found.original;
  }

  // 2. Check contains / includes match
  for (const syn of synonyms) {
    const found = normalizedHeaders.find((h) =>
      h.normalized.includes(syn) || syn.includes(h.normalized)
    );
    if (found) return found.original;
  }

  return '';
}

/**
 * Automatically suggests column mapping based on spreadsheet headers
 */
export function suggestColumnMapping(headers: string[]): ColumnMapping {
  return {
    title: findBestHeaderMatch(headers, COLUMN_SYNONYMS.title),
    date: findBestHeaderMatch(headers, COLUMN_SYNONYMS.date),
    startTime: findBestHeaderMatch(headers, COLUMN_SYNONYMS.startTime),
    endTime: findBestHeaderMatch(headers, COLUMN_SYNONYMS.endTime),
    duration: findBestHeaderMatch(headers, COLUMN_SYNONYMS.duration),
    meetingUrl: findBestHeaderMatch(headers, COLUMN_SYNONYMS.meetingUrl),
    description: findBestHeaderMatch(headers, COLUMN_SYNONYMS.description),
    location: findBestHeaderMatch(headers, COLUMN_SYNONYMS.location),
    alarmOffset: findBestHeaderMatch(headers, COLUMN_SYNONYMS.alarmOffset),
    organizerName: findBestHeaderMatch(headers, COLUMN_SYNONYMS.organizerName),
    organizerEmail: findBestHeaderMatch(headers, COLUMN_SYNONYMS.organizerEmail),
  };
}

export interface MapOptions {
  timezone?: string;
  defaultAlarmOffsetMinutes?: number;
  defaultDurationMinutes?: number;
}

/**
 * Maps spreadsheet rows to candidate parsed meetings with full diagnostics
 */
export function mapSpreadsheetRowsToMeetings(
  rawRows: SpreadsheetRow[],
  mapping: ColumnMapping,
  options: MapOptions = {}
): ParsedMeetingRow[] {
  const tz = options.timezone || getDeviceTimezone();
  const defaultAlarmOffset = options.defaultAlarmOffsetMinutes !== undefined ? options.defaultAlarmOffsetMinutes : 15;
  const defaultDuration = options.defaultDurationMinutes || 30;

  return rawRows.map((row, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Title
    const rawTitle = mapping.title ? String(row[mapping.title] || '').trim() : '';
    let title = rawTitle;
    if (!title) {
      errors.push('Meeting title is required but was empty');
      title = `Imported Meeting #${index + 1}`;
    }

    // 2. Date & Times
    const dateVal = mapping.date ? row[mapping.date] : undefined;
    const startTimeVal = mapping.startTime ? row[mapping.startTime] : undefined;
    const endTimeVal = mapping.endTime ? row[mapping.endTime] : undefined;
    const durationVal = mapping.duration ? row[mapping.duration] : undefined;

    const timeResult = validateAndBuildMeetingTimes({
      dateValue: dateVal,
      startTimeValue: startTimeVal,
      endTimeValue: endTimeVal,
      durationValue: durationVal,
      timezone: tz,
      defaultDurationMinutes: defaultDuration,
    });

    if (timeResult.errors.length > 0) {
      errors.push(...timeResult.errors);
    }

    // 3. Meeting URL & Platform
    const rawUrl = mapping.meetingUrl ? String(row[mapping.meetingUrl] || '').trim() : '';
    const rawDesc = mapping.description ? String(row[mapping.description] || '').trim() : '';
    const rawLoc = mapping.location ? String(row[mapping.location] || '').trim() : '';

    const extracted = extractMeetingLink({
      directUrl: rawUrl,
      location: rawLoc,
      description: rawDesc,
    });

    // 4. Alarm Offset
    let alarmOffsetMinutes = defaultAlarmOffset;
    if (mapping.alarmOffset && row[mapping.alarmOffset] !== undefined && row[mapping.alarmOffset] !== '') {
      const parsedAlarm = parseDurationToMinutes(row[mapping.alarmOffset]);
      if (parsedAlarm >= 0) {
        alarmOffsetMinutes = parsedAlarm;
      }
    }

    // 5. Organizer
    const organizerName = mapping.organizerName ? String(row[mapping.organizerName] || '').trim() : undefined;
    const organizerEmail = mapping.organizerEmail ? String(row[mapping.organizerEmail] || '').trim() : undefined;

    if (!extracted?.url && !rawLoc) {
      warnings.push('No meeting link or location specified');
    }

    let status: ImportRowStatus = 'valid';
    if (errors.length > 0) {
      status = 'error';
    } else if (warnings.length > 0) {
      status = 'warning';
    }

    return {
      rowIndex: index + 1,
      raw: row,
      title,
      date: String(dateVal || ''),
      startTime: String(startTimeVal || ''),
      endTime: String(endTimeVal || ''),
      durationMinutes: timeResult.durationMinutes,
      meetingUrl: extracted?.url || (rawUrl || undefined),
      description: rawDesc || undefined,
      location: rawLoc || undefined,
      alarmOffsetMinutes,
      organizerName: organizerName || undefined,
      organizerEmail: organizerEmail || undefined,
      computedStartIso: timeResult.startIso || undefined,
      computedEndIso: timeResult.endIso || undefined,
      status,
      errors,
      warnings,
      isSelected: status !== 'error', // Auto-select valid and warning rows
    };
  });
}

/**
 * Converts selected parsed meeting rows into CreateMeetingInput objects ready for SQLite insertion
 */
export function convertParsedRowsToMeetingInputs(
  parsedRows: ParsedMeetingRow[],
  timezone?: string
): Array<{ meeting: CreateMeetingInput; alarmOffsetMinutes: number }> {
  const tz = timezone || getDeviceTimezone();

  return parsedRows
    .filter((r) => r.isSelected && r.status !== 'error' && r.computedStartIso && r.computedEndIso)
    .map((r) => ({
      meeting: {
        title: r.title,
        description: r.description,
        startTime: r.computedStartIso!,
        endTime: r.computedEndIso!,
        timezone: tz,
        location: r.location,
        meetingUrl: r.meetingUrl,
        platform: identifyPlatform(r.meetingUrl),
        organizerName: r.organizerName,
        organizerEmail: r.organizerEmail,
        source: 'imported',
        status: 'upcoming',
        isAllDay: false,
        rawData: r.raw,
      },
      alarmOffsetMinutes: r.alarmOffsetMinutes !== undefined ? r.alarmOffsetMinutes : 15,
    }));
}
