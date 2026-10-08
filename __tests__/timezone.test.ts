import {
  normalizeToUtcIso,
  parseAllDayBounds,
  formatInTz,
  getDayBoundariesInTz,
} from '../utils/timezone';

describe('Timezone Utilities', () => {
  describe('normalizeToUtcIso', () => {
    it('normalizes ISO string with timezone offset', () => {
      const input = '2026-09-25T10:00:00+02:00';
      const normalized = normalizeToUtcIso(input);
      expect(normalized).toBe('2026-09-25T08:00:00.000Z');
    });

    it('normalizes date-only string in specified timezone', () => {
      const input = '2026-09-25';
      const normalized = normalizeToUtcIso(input, 'UTC');
      expect(normalized).toBe('2026-09-25T00:00:00.000Z');
    });
  });

  describe('parseAllDayBounds', () => {
    it('correctly calculates exclusive Google all-day event bounds', () => {
      const bounds = parseAllDayBounds('2026-09-25', '2026-09-26', 'UTC');
      expect(bounds.startIso).toBe('2026-09-25T00:00:00.000Z');
      expect(bounds.endIso).toBe('2026-09-26T00:00:00.000Z');
    });

    it('handles single-day date string without end date', () => {
      const bounds = parseAllDayBounds('2026-09-25', undefined, 'UTC');
      expect(bounds.startIso).toBe('2026-09-25T00:00:00.000Z');
      expect(bounds.endIso).toBe('2026-09-25T23:59:59.999Z');
    });
  });

  describe('formatInTz', () => {
    it('formats a UTC timestamp in target timezone', () => {
      const utcIso = '2026-09-25T14:30:00.000Z';
      const nyFormatted = formatInTz(utcIso, 'h:mm a', 'America/New_York');
      expect(nyFormatted).toBe('10:30 AM');

      const tokyoFormatted = formatInTz(utcIso, 'h:mm a', 'Asia/Tokyo');
      expect(tokyoFormatted).toBe('11:30 PM');
    });
  });

  describe('getDayBoundariesInTz', () => {
    it('returns start and end of day in UTC bounds', () => {
      const boundaries = getDayBoundariesInTz(new Date('2026-09-25T12:00:00Z'), 'UTC');
      expect(boundaries.startIso).toBe('2026-09-25T00:00:00.000Z');
      expect(boundaries.endIso).toBe('2026-09-25T23:59:59.999Z');
    });

    it('returns start and end of day in Asia/Kolkata (+5:30)', () => {
      // 2026-10-07 in Asia/Kolkata: 00:00 IST is 2026-10-06 18:30 UTC, 23:59:59.999 IST is 2026-10-07 18:29:59.999 UTC
      const boundaries = getDayBoundariesInTz(new Date('2026-10-07T10:00:00Z'), 'Asia/Kolkata');
      expect(boundaries.startIso).toBe('2026-10-06T18:30:00.000Z');
      expect(boundaries.endIso).toBe('2026-10-07T18:29:59.999Z');
    });

    it('returns start and end of day in America/New_York (EDT, -4:00)', () => {
      const boundaries = getDayBoundariesInTz(new Date('2026-09-25T12:00:00Z'), 'America/New_York');
      expect(boundaries.startIso).toBe('2026-09-25T04:00:00.000Z');
      expect(boundaries.endIso).toBe('2026-09-26T03:59:59.999Z');
    });
  });
});
