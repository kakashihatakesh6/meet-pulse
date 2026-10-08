import {
  suggestColumnMapping,
  mapSpreadsheetRowsToMeetings,
} from '../services/imports/meeting.mapper';

describe('Column Mapping & Row Mapping', () => {
  describe('suggestColumnMapping', () => {
    it('fuzzy matches various column header naming variations', () => {
      const headers = [
        'Meeting Name',
        'Meeting Date',
        'Start Time',
        'End Time',
        'Zoom Link',
        'Notes',
        'Reminder (mins)',
      ];

      const mapping = suggestColumnMapping(headers);

      expect(mapping.title).toBe('Meeting Name');
      expect(mapping.date).toBe('Meeting Date');
      expect(mapping.startTime).toBe('Start Time');
      expect(mapping.endTime).toBe('End Time');
      expect(mapping.meetingUrl).toBe('Zoom Link');
      expect(mapping.description).toBe('Notes');
      expect(mapping.alarmOffset).toBe('Reminder (mins)');
    });

    it('matches single word headers', () => {
      const headers = ['Topic', 'Date', 'Start', 'End', 'URL', 'Location'];
      const mapping = suggestColumnMapping(headers);

      expect(mapping.title).toBe('Topic');
      expect(mapping.date).toBe('Date');
      expect(mapping.startTime).toBe('Start');
      expect(mapping.endTime).toBe('End');
      expect(mapping.meetingUrl).toBe('URL');
      expect(mapping.location).toBe('Location');
    });
  });

  describe('mapSpreadsheetRowsToMeetings', () => {
    it('maps valid rows correctly into parsed meetings', () => {
      const rawRows = [
        {
          'Meeting Title': 'Architecture Review',
          'Date': '2026-09-25',
          'Start': '10:00 AM',
          'End': '11:00 AM',
          'Link': 'https://meet.google.com/abc-defg-hij',
        },
      ];

      const mapping = {
        title: 'Meeting Title',
        date: 'Date',
        startTime: 'Start',
        endTime: 'End',
        meetingUrl: 'Link',
      };

      const parsed = mapSpreadsheetRowsToMeetings(rawRows, mapping, {
        timezone: 'UTC',
        defaultAlarmOffsetMinutes: 15,
      });

      expect(parsed).toHaveLength(1);
      expect(parsed[0].status).toBe('valid');
      expect(parsed[0].title).toBe('Architecture Review');
      expect(parsed[0].computedStartIso).toBe('2026-09-25T10:00:00.000Z');
      expect(parsed[0].computedEndIso).toBe('2026-09-25T11:00:00.000Z');
      expect(parsed[0].meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
      expect(parsed[0].alarmOffsetMinutes).toBe(15);
      expect(parsed[0].isSelected).toBe(true);
    });

    it('flags rows with missing required fields with error status', () => {
      const rawRows = [
        {
          'Meeting Title': '',
          'Date': 'invalid-date',
          'Start': '10:00 AM',
        },
      ];

      const mapping = {
        title: 'Meeting Title',
        date: 'Date',
        startTime: 'Start',
      };

      const parsed = mapSpreadsheetRowsToMeetings(rawRows, mapping, {
        timezone: 'UTC',
      });

      expect(parsed[0].status).toBe('error');
      expect(parsed[0].errors.length).toBeGreaterThan(0);
      expect(parsed[0].isSelected).toBe(false);
    });
  });
});
