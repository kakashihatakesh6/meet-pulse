import { subDays, addDays } from 'date-fns';
import { GOOGLE_API_ENDPOINTS } from '../../constants/oauth';
import { GoogleOAuthService } from './oauth';
import {
  CalendarEntity,
  GoogleCalendarListEntry,
  GoogleCalendarEventItem,
} from '../../types/calendar';
import { CreateMeetingInput, Attendee } from '../../types/meeting';
import {
  GoogleCalendarListEntrySchema,
  GoogleCalendarEventItemSchema,
} from '../../utils/validation';
import { parseAllDayBounds, normalizeToUtcIso, getDeviceTimezone } from '../../utils/timezone';
import { extractMeetingLink, identifyPlatform } from '../../utils/meeting-url';
import { logger } from '../../utils/logger';

export interface FetchEventsOptions {
  timeMin?: string;
  timeMax?: string;
  syncToken?: string;
  pageToken?: string;
  maxResults?: number;
}

export interface FetchEventsResponse {
  items: GoogleCalendarEventItem[];
  nextPageToken?: string;
  nextSyncToken?: string;
  isFullSyncRequired?: boolean;
}

export const GoogleCalendarService = {
  /**
   * Fetches the user's calendars from Google Calendar API
   */
  async fetchCalendarList(): Promise<CalendarEntity[]> {
    const accessToken = await GoogleOAuthService.getValidAccessToken();
    const url = `${GOOGLE_API_ENDPOINTS.calendarList}?minAccessRole=reader`;

    logger.info('Fetching user calendar list from Google Calendar API');
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch calendars (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    const calendars: CalendarEntity[] = [];
    for (const rawItem of items) {
      try {
        const validated = GoogleCalendarListEntrySchema.parse(rawItem);
        calendars.push({
          id: validated.id,
          googleCalendarId: validated.id,
          summary: validated.summary,
          description: validated.description,
          primary: !!validated.primary,
          backgroundColor: validated.backgroundColor || '#4F46E5',
          foregroundColor: validated.foregroundColor || '#FFFFFF',
          isEnabled: true, // Always enable all user calendars by default
          accessRole: (validated.accessRole as CalendarEntity['accessRole']) || 'reader',
          timeZone: validated.timeZone,
        });
      } catch (err) {
        logger.warn('Skipping invalid calendar item', err);
      }
    }

    return calendars;
  },

  /**
   * Fetches events for a specific calendar, supporting incremental sync tokens and auto-pagination
   */
  async fetchEvents(
    calendarId: string,
    options: FetchEventsOptions = {}
  ): Promise<FetchEventsResponse> {
    const accessToken = await GoogleOAuthService.getValidAccessToken();

    // Default window: 365 days in past to 180 days in future
    const now = new Date();
    const defaultTimeMin = subDays(now, 365).toISOString();
    const defaultTimeMax = addDays(now, 180).toISOString();

    const allValidatedItems: GoogleCalendarEventItem[] = [];
    let currentPageToken: string | undefined = options.pageToken;
    let finalNextSyncToken: string | undefined = undefined;
    let pageCount = 0;
    const MAX_PAGES = 10; // Fetch up to 2500 events per calendar

    do {
      pageCount++;
      const queryParams = new URLSearchParams();

      if (options.syncToken && !currentPageToken) {
        // When syncToken is present, Google requires omitting timeMin/timeMax
        queryParams.set('syncToken', options.syncToken);
      } else {
        queryParams.set('timeMin', options.timeMin || defaultTimeMin);
        queryParams.set('timeMax', options.timeMax || defaultTimeMax);
        queryParams.set('singleEvents', 'true'); // Expands recurring events into instances
        queryParams.set('orderBy', 'startTime');
      }

      if (currentPageToken) {
        queryParams.set('pageToken', currentPageToken);
      }

      queryParams.set('maxResults', String(options.maxResults || 250));

      const url = `${GOOGLE_API_ENDPOINTS.calendarEvents(calendarId)}?${queryParams.toString()}`;
      logger.info(`Fetching events for calendar: ${calendarId} (page ${pageCount})`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      // Handle 410 Gone (expired sync token) -> requires full re-sync
      if (response.status === 410) {
        logger.warn(`Sync token expired for calendar ${calendarId}. Triggering full sync.`);
        return {
          items: [],
          isFullSyncRequired: true,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        // If 404 or specific error on calendarId, log and throw
        throw new Error(`Failed to fetch events (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const rawItems = Array.isArray(data.items) ? data.items : [];

      for (const raw of rawItems) {
        try {
          const item = GoogleCalendarEventItemSchema.parse(raw);
          allValidatedItems.push(item);
        } catch (err) {
          logger.warn('Skipping malformed calendar event', err);
        }
      }

      currentPageToken = data.nextPageToken;
      if (data.nextSyncToken) {
        finalNextSyncToken = data.nextSyncToken;
      }
    } while (currentPageToken && pageCount < MAX_PAGES);

    return {
      items: allValidatedItems,
      nextPageToken: currentPageToken,
      nextSyncToken: finalNextSyncToken,
      isFullSyncRequired: false,
    };
  },

  /**
   * Normalizes a raw Google Calendar API event into our internal Meeting model
   */
  normalizeGoogleEvent(
    event: GoogleCalendarEventItem,
    calendarId: string,
    defaultTimezone?: string
  ): CreateMeetingInput | null {
    if (!event.id) return null;

    const tz =
      event.start?.timeZone ||
      event.end?.timeZone ||
      defaultTimezone ||
      getDeviceTimezone();

    let startIso: string;
    let endIso: string;
    let isAllDay = false;

    // 1. Check for all-day event (specified via date: "YYYY-MM-DD")
    if (event.start?.date) {
      isAllDay = true;
      const bounds = parseAllDayBounds(event.start.date, event.end?.date, tz);
      startIso = bounds.startIso;
      endIso = bounds.endIso;
    } else if (event.start?.dateTime) {
      // 2. Timed event with dateTime (e.g. "2026-09-25T10:00:00-04:00")
      try {
        startIso = normalizeToUtcIso(event.start.dateTime, tz);
        if (event.end?.dateTime) {
          endIso = normalizeToUtcIso(event.end.dateTime, tz);
        } else {
          // If no end time, default to 30 mins after start
          const startDt = new Date(startIso);
          endIso = new Date(startDt.getTime() + 30 * 60 * 1000).toISOString();
        }
      } catch (err) {
        logger.warn(`Failed to parse dateTime for event ${event.id}`, err);
        return null;
      }
    } else {
      // Missing start information
      logger.warn(`Event ${event.id} missing start date/time. Skipping.`);
      return null;
    }

    // Extract video conferencing links
    const conferenceUri = event.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video' || ep.uri
    )?.uri;

    const extractedLink = extractMeetingLink({
      directUrl: conferenceUri || event.hangoutLink,
      hangoutLink: event.hangoutLink,
      conferenceUri,
      location: event.location,
      description: event.description,
    });

    // Parse attendees
    const attendees: Attendee[] = (event.attendees || []).map((att) => ({
      email: att.email || '',
      displayName: att.displayName || att.email || 'Participant',
      responseStatus: (att.responseStatus as any) || 'needsAction',
      self: att.self,
      organizer: att.organizer,
    }));

    // Status mapping
    const status =
      event.status === 'cancelled'
        ? 'cancelled'
        : 'upcoming'; // Will be calculated dynamically based on time

    // Clean up summary / title
    let title = event.summary?.trim() || '';
    if (!title || /^[,.\-_:;/\\]+$/.test(title)) {
      if (event.description) {
        const cleanDesc = event.description.replace(/<[^>]*>/g, '').trim();
        const firstLine = cleanDesc.split('\n')[0].trim();
        if (firstLine && firstLine.length > 1 && !firstLine.toLowerCase().startsWith('event name')) {
          title = firstLine;
        } else if (cleanDesc.includes('Event Name\n') || cleanDesc.includes('Event Name:')) {
          const nameMatch = cleanDesc.match(/Event Name[:\s]+([^\n]+)/i);
          if (nameMatch && nameMatch[1]) {
            title = nameMatch[1].trim();
          }
        }
      }
      if (!title || /^[,.\-_:;/\\]+$/.test(title)) {
        if (event.location && !event.location.startsWith('http')) {
          title = event.location.split(',')[0].trim();
        }
      }
      if (!title || /^[,.\-_:;/\\]+$/.test(title)) {
        title = extractedLink?.platform === 'zoom' ? 'Zoom Meeting' : extractedLink?.platform === 'google_meet' ? 'Google Meet' : 'Calendar Event';
      }
    }

    return {
      googleEventId: event.id,
      calendarId,
      title,
      description: event.description,
      startTime: startIso,
      endTime: endIso,
      timezone: tz,
      location: event.location,
      meetingUrl: extractedLink?.url,
      platform: extractedLink?.platform || identifyPlatform(event.location),
      organizerName: event.organizer?.displayName || event.organizer?.email,
      organizerEmail: event.organizer?.email,
      attendees,
      source: 'google_calendar',
      status,
      isAllDay,
      recurringEventId: event.recurringEventId,
      rawData: event as unknown as Record<string, unknown>,
    };
  },
};
