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

  it('normalizes events with explicit timezone offsets e.g. +05:30', () => {
    const event: GoogleCalendarEventItem = {
      id: 'kl4qdt9r9salkijaadvkb6i9s4',
      summary: 'Zoom Interview',
      start: {
        dateTime: '2026-10-08T07:20:00+05:30',
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: '2026-10-08T08:20:00+05:30',
        timeZone: 'Asia/Kolkata',
      },
      location: 'Zoom, 55 Almaden Boulevard',
    };

    const normalized = GoogleCalendarService.normalizeGoogleEvent(event, 'primary', 'Asia/Kolkata');
    expect(normalized).not.toBeNull();
    expect(normalized?.startTime).toBe('2026-10-08T01:50:00.000Z');
    expect(normalized?.endTime).toBe('2026-10-08T02:50:00.000Z');
  });

  it('filters all today and week events accurately in Asia/Kolkata', () => {
    const rawEvents: GoogleCalendarEventItem[] = [
      {
        id: '6q6icdsoco2rnil5fh658cgm21',
        summary: 'First Meeting',
        start: { dateTime: '2026-10-05T15:00:00+05:30', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-10-05T16:00:00+05:30', timeZone: 'Asia/Kolkata' },
      },
      {
        id: 'kl4qdt9r9salkijaadvkb6i9s4',
        summary: 'Early Morning Zoom',
        start: { dateTime: '2026-10-08T07:20:00+05:30', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-10-08T08:20:00+05:30', timeZone: 'Asia/Kolkata' },
      },
      {
        id: '2sujim52iirnlnou5bv2e0af6h',
        summary: 'Zero meeting',
        start: { dateTime: '2026-10-08T14:00:00+05:30', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-10-08T15:00:00+05:30', timeZone: 'Asia/Kolkata' },
      },
      {
        id: '15p2755bphhvhaa6b239ij3nna',
        summary: 'New Meeting First',
        start: { dateTime: '2026-10-08T20:30:00+05:30', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-10-08T21:30:00+05:30', timeZone: 'Asia/Kolkata' },
      },
      {
        id: '2nlvlu29l90i4ssqldrsfqin5o',
        summary: 'Last Meeting',
        start: { dateTime: '2026-10-08T23:00:00+05:30', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-10-09T00:00:00+05:30', timeZone: 'Asia/Kolkata' },
      },
      {
        id: '4fjlvkua773s0lg6sn8d2ir4rk',
        summary: 'Uganda',
        start: { dateTime: '2026-10-09T15:00:00+05:30', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-10-09T16:00:00+05:30', timeZone: 'Asia/Kolkata' },
      },
      {
        id: '5m4pu0098vi7jdfgum2g97lc7r',
        summary: 'Varanashi',
        start: { dateTime: '2026-10-10T17:00:00+05:30', timeZone: 'Asia/Kolkata' },
        end: { dateTime: '2026-10-10T18:00:00+05:30', timeZone: 'Asia/Kolkata' },
      },
    ];

    const normalizedList = rawEvents
      .map((e) => GoogleCalendarService.normalizeGoogleEvent(e, 'primary', 'Asia/Kolkata'))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const { getDayBoundariesInTz, getWeekBoundariesInTz } = require('../utils/timezone');
    const now = new Date('2026-10-08T14:28:24.011Z');

    // Today's range in Asia/Kolkata
    const todayBounds = getDayBoundariesInTz(now, 'Asia/Kolkata');
    const todayMeetings = normalizedList.filter(
      (m) =>
        (m.startTime <= todayBounds.endIso && m.endTime >= todayBounds.startIso) ||
        (m.startTime >= todayBounds.startIso && m.startTime <= todayBounds.endIso) ||
        (m.endTime >= todayBounds.startIso && m.endTime <= todayBounds.endIso)
    );
    expect(todayMeetings).toHaveLength(4);
    expect(todayMeetings.map((m) => m.googleEventId)).toEqual([
      'kl4qdt9r9salkijaadvkb6i9s4',
      '2sujim52iirnlnou5bv2e0af6h',
      '15p2755bphhvhaa6b239ij3nna',
      '2nlvlu29l90i4ssqldrsfqin5o',
    ]);

    // Week range in Asia/Kolkata
    const weekBounds = getWeekBoundariesInTz(now, 'Asia/Kolkata');
    const weekMeetings = normalizedList.filter(
      (m) =>
        (m.startTime <= weekBounds.endIso && m.endTime >= weekBounds.startIso) ||
        (m.startTime >= weekBounds.startIso && m.startTime <= weekBounds.endIso) ||
        (m.endTime >= weekBounds.startIso && m.endTime <= weekBounds.endIso)
    );
    expect(weekMeetings).toHaveLength(7);
  });
});
