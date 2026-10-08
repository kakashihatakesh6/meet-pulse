export interface CalendarEntity {
  id: string; // Internal UUID
  googleCalendarId: string; // Google Calendar ID (e.g., "primary", "work@company.com")
  summary: string;
  description?: string;
  primary: boolean;
  backgroundColor: string;
  foregroundColor: string;
  isEnabled: boolean; // Whether meetings from this calendar are synced & displayed
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  timeZone?: string;
  lastSyncedAt?: string;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
  timeZone?: string;
  selected?: boolean;
}

export interface GoogleCalendarEventDate {
  date?: string; // For all-day events: "2026-09-25"
  dateTime?: string; // For timed events: "2026-09-25T10:00:00-04:00"
  timeZone?: string;
}

export interface GoogleCalendarEventItem {
  id: string;
  status?: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleCalendarEventDate;
  end?: GoogleCalendarEventDate;
  endTimeUnspecified?: boolean;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleCalendarEventDate;
  hangoutLink?: string;
  conferenceData?: any;
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
    organizer?: boolean;
  }>;
  created?: string;
  updated?: string;
}
