import {
  formatMeetingTime,
  formatMeetingDate,
  getRelativeTimeLabel,
  calculateDurationMinutes,
  formatDuration,
  computeMeetingStatus,
  formatTimeAgo,
} from '../utils/dates';

describe('Date Utilities', () => {
  const mockStart = '2026-09-25T10:00:00.000Z';
  const mockEnd = '2026-09-25T11:00:00.000Z';

  describe('formatMeetingTime', () => {
    it('formats timed events correctly', () => {
      const formatted = formatMeetingTime(mockStart, mockEnd, 'UTC');
      expect(formatted).toBe('10:00 AM – 11:00 AM');
    });

    it('returns "All day" when isAllDay is true', () => {
      const formatted = formatMeetingTime(mockStart, mockEnd, 'UTC', true);
      expect(formatted).toBe('All day');
    });
  });

  describe('calculateDurationMinutes', () => {
    it('calculates difference between start and end accurately', () => {
      expect(calculateDurationMinutes(mockStart, mockEnd)).toBe(60);

      const thirtyMinEnd = '2026-09-25T10:30:00.000Z';
      expect(calculateDurationMinutes(mockStart, thirtyMinEnd)).toBe(30);

      const ninetyMinEnd = '2026-09-25T11:30:00.000Z';
      expect(calculateDurationMinutes(mockStart, ninetyMinEnd)).toBe(90);
    });

    it('returns 0 for identical or inverted times', () => {
      expect(calculateDurationMinutes(mockStart, mockStart)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('formats durations in human readable form', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(15)).toBe('15m');
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(120)).toBe('2h');
    });
  });

  describe('computeMeetingStatus', () => {
    it('returns cancelled if original status was cancelled', () => {
      expect(computeMeetingStatus(mockStart, mockEnd, 'cancelled')).toBe('cancelled');
    });

    it('returns upcoming for future meetings', () => {
      const futureStart = new Date(Date.now() + 3600000).toISOString();
      const futureEnd = new Date(Date.now() + 7200000).toISOString();
      expect(computeMeetingStatus(futureStart, futureEnd)).toBe('upcoming');
    });

    it('returns in_progress for ongoing meetings', () => {
      const ongoingStart = new Date(Date.now() - 100000).toISOString();
      const ongoingEnd = new Date(Date.now() + 100000).toISOString();
      expect(computeMeetingStatus(ongoingStart, ongoingEnd)).toBe('in_progress');
    });

    it('returns completed for ended meetings', () => {
      const pastStart = new Date(Date.now() - 7200000).toISOString();
      const pastEnd = new Date(Date.now() - 3600000).toISOString();
      expect(computeMeetingStatus(pastStart, pastEnd)).toBe('completed');
    });
  });

  describe('formatTimeAgo', () => {
    it('handles recent timestamps', () => {
      const now = new Date().toISOString();
      expect(formatTimeAgo(now)).toBe('Just now');
    });

    it('handles undefined gracefully', () => {
      expect(formatTimeAgo(undefined)).toBe('Never synced');
    });
  });
});
