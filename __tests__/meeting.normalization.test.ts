import { GoogleCalendarService } from '../services/google/calendar';
import { GoogleCalendarEventItem } from '../types/calendar';

describe('Google Calendar Event Normalization', () => {
  it('normalizes standard Google Calendar timed events', () => {
    const event: GoogleCalendarEventItem = {
      id: 'g_event_123',
      summary: 'Product Strategy Discussion',
      description: 'Quarterly roadmap sync',
      start: {
        dateTime: '2026-09-25T14:00:00Z',
        timeZone: 'UTC',
      },
      end: {
        dateTime: '2026-09-25T15:00:00Z',
        timeZone: 'UTC',
      },
      hangoutLink: 'https://meet.google.com/xyz-uvwx-rst',
      organizer: {
        email: 'leader@company.com',
        displayName: 'Team Lead',
      },
      attendees: [
        { email: 'member1@company.com', responseStatus: 'accepted' },
        { email: 'member2@company.com', responseStatus: 'tentative' },
      ],
    };

    const normalized = GoogleCalendarService.normalizeGoogleEvent(event, 'primary');

    expect(normalized).not.toBeNull();
    expect(normalized?.googleEventId).toBe('g_event_123');
    expect(normalized?.title).toBe('Product Strategy Discussion');
    expect(normalized?.startTime).toBe('2026-09-25T14:00:00.000Z');
    expect(normalized?.endTime).toBe('2026-09-25T15:00:00.000Z');
    expect(normalized?.meetingUrl).toBe('https://meet.google.com/xyz-uvwx-rst');
    expect(normalized?.platform).toBe('google_meet');
    expect(normalized?.organizerEmail).toBe('leader@company.com');
    expect(normalized?.attendees).toHaveLength(2);
    expect(normalized?.source).toBe('google_calendar');
  });

  it('normalizes Google Calendar all-day events', () => {
    const event: GoogleCalendarEventItem = {
      id: 'g_allday_456',
      summary: 'Company Hackathon',
      start: {
        date: '2026-09-25',
      },
      end: {
        date: '2026-09-26',
      },
    };

    const normalized = GoogleCalendarService.normalizeGoogleEvent(event, 'primary', 'UTC');

    expect(normalized).not.toBeNull();
    expect(normalized?.isAllDay).toBe(true);
    expect(normalized?.startTime).toBe('2026-09-25T00:00:00.000Z');
    expect(normalized?.endTime).toBe('2026-09-26T00:00:00.000Z');
  });

  it('detects Zoom and Teams links embedded inside location or description', () => {
    const zoomEvent: GoogleCalendarEventItem = {
      id: 'g_zoom_789',
      summary: 'Client Catchup',
      location: 'https://us02web.zoom.us/j/1234567890?pwd=abc',
      start: { dateTime: '2026-09-25T16:00:00Z' },
      end: { dateTime: '2026-09-25T16:30:00Z' },
    };

    const normalizedZoom = GoogleCalendarService.normalizeGoogleEvent(zoomEvent, 'primary');
    expect(normalizedZoom?.platform).toBe('zoom');
    expect(normalizedZoom?.meetingUrl).toBe('https://us02web.zoom.us/j/1234567890?pwd=abc');

    const teamsEvent: GoogleCalendarEventItem = {
      id: 'g_teams_101',
      summary: 'Vendor Sync',
      description: 'Join on Teams: https://teams.microsoft.com/l/meetup-join/abc123xyz',
      start: { dateTime: '2026-09-25T17:00:00Z' },
      end: { dateTime: '2026-09-25T17:30:00Z' },
    };

    const normalizedTeams = GoogleCalendarService.normalizeGoogleEvent(teamsEvent, 'primary');
    expect(normalizedTeams?.platform).toBe('teams');
    expect(normalizedTeams?.meetingUrl).toBe('https://teams.microsoft.com/l/meetup-join/abc123xyz');
  });
});
