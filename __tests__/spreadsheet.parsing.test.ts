import {
  parseTimeString,
  parseDateString,
  parseDurationToMinutes,
  validateAndBuildMeetingTimes,
  parseExcelSerialDate,
} from '../utils/validation';

describe('Spreadsheet & Date/Time Parsing', () => {
  describe('parseTimeString', () => {
    it('parses 12-hour AM/PM formats', () => {
      expect(parseTimeString('10:30 AM')).toEqual({ hours: 10, minutes: 30 });
      expect(parseTimeString('2:15 PM')).toEqual({ hours: 14, minutes: 15 });
      expect(parseTimeString('12:00 PM')).toEqual({ hours: 12, minutes: 0 });
      expect(parseTimeString('12:00 AM')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTimeString('9:45pm')).toEqual({ hours: 21, minutes: 45 });
    });

    it('parses 24-hour military formats', () => {
      expect(parseTimeString('14:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseTimeString('09:15')).toEqual({ hours: 9, minutes: 15 });
      expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTimeString('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('parses Excel fractional days', () => {
      // 0.5 = 12:00 PM
      expect(parseTimeString(0.5)).toEqual({ hours: 12, minutes: 0 });
    });

    it('returns null for invalid strings', () => {
      expect(parseTimeString('invalid_time')).toBeNull();
      expect(parseTimeString('')).toBeNull();
    });
  });

  describe('parseDateString', () => {
    it('parses ISO format YYYY-MM-DD', () => {
      expect(parseDateString('2026-09-25')).toEqual({ year: 2026, month: 9, day: 25 });
    });

    it('parses US format MM/DD/YYYY', () => {
      expect(parseDateString('09/25/2026')).toEqual({ year: 2026, month: 9, day: 25 });
    });

    it('parses EU format DD-MM-YYYY', () => {
      expect(parseDateString('25-09-2026')).toEqual({ year: 2026, month: 9, day: 25 });
    });

    it('returns null for invalid date strings', () => {
      expect(parseDateString('not-a-date')).toBeNull();
    });
  });

  describe('parseDurationToMinutes', () => {
    it('parses hour and minute string formats', () => {
      expect(parseDurationToMinutes('30')).toBe(30);
      expect(parseDurationToMinutes('45m')).toBe(45);
      expect(parseDurationToMinutes('1h')).toBe(60);
      expect(parseDurationToMinutes('1.5 hours')).toBe(90);
      expect(parseDurationToMinutes('2 hrs')).toBe(120);
    });

    it('defaults to 30 for invalid values', () => {
      expect(parseDurationToMinutes(undefined)).toBe(30);
      expect(parseDurationToMinutes('abc')).toBe(30);
    });
  });

  describe('validateAndBuildMeetingTimes', () => {
    it('constructs start and end ISO strings accurately', () => {
      const result = validateAndBuildMeetingTimes({
        dateValue: '2026-09-25',
        startTimeValue: '10:00 AM',
        endTimeValue: '11:00 AM',
        timezone: 'UTC',
      });

      expect(result.errors).toHaveLength(0);
      expect(result.startIso).toBe('2026-09-25T10:00:00.000Z');
      expect(result.endIso).toBe('2026-09-25T11:00:00.000Z');
      expect(result.durationMinutes).toBe(60);
    });

    it('handles meetings crossing midnight into the next day', () => {
      const result = validateAndBuildMeetingTimes({
        dateValue: '2026-09-25',
        startTimeValue: '11:30 PM',
        endTimeValue: '12:30 AM',
        timezone: 'UTC',
      });

      expect(result.errors).toHaveLength(0);
      expect(result.startIso).toBe('2026-09-25T23:30:00.000Z');
      expect(result.endIso).toBe('2026-09-26T00:30:00.000Z');
      expect(result.durationMinutes).toBe(60);
    });

    it('reports errors for missing or invalid dates', () => {
      const result = validateAndBuildMeetingTimes({
        dateValue: 'invalid-date',
        startTimeValue: '10:00 AM',
        timezone: 'UTC',
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.startIso).toBe('');
    });
  });
});
