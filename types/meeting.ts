import { Alarm } from './alarm';

export type MeetingSource = 'google_calendar' | 'imported';

export type MeetingStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

export type MeetingPlatform =
  | 'google_meet'
  | 'zoom'
  | 'teams'
  | 'webex'
  | 'slack'
  | 'other'
  | 'none';

export type AttendeeResponseStatus =
  | 'needsAction'
  | 'declined'
  | 'tentative'
  | 'accepted';

export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: AttendeeResponseStatus;
  self?: boolean;
  organizer?: boolean;
}

export interface Organizer {
  email: string;
  displayName?: string;
  self?: boolean;
}

export interface Meeting {
  id: string; // Internal UUID
  googleEventId?: string; // External Google Event ID if source is google_calendar
  calendarId: string; // Associated calendar ID (e.g. 'primary' or specific calendar UUID)
  title: string;
  description?: string;
  startTime: string; // ISO 8601 UTC timestamp
  endTime: string; // ISO 8601 UTC timestamp
  timezone: string; // e.g. "America/New_York", "Asia/Kolkata", "UTC"
  location?: string;
  meetingUrl?: string; // Direct video conferencing URL (Meet, Zoom, Teams, etc.)
  platform: MeetingPlatform;
  organizerName?: string;
  organizerEmail?: string;
  attendees: Attendee[];
  source: MeetingSource;
  status: MeetingStatus;
  isAllDay: boolean;
  recurringEventId?: string;
  rawData?: Record<string, unknown>; // Preserved raw event payload if needed
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export interface MeetingWithAlarms extends Meeting {
  alarms: Alarm[];
}

export interface CreateMeetingInput {
  googleEventId?: string;
  calendarId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  location?: string;
  meetingUrl?: string;
  platform?: MeetingPlatform;
  organizerName?: string;
  organizerEmail?: string;
  attendees?: Attendee[];
  source?: MeetingSource;
  status?: MeetingStatus;
  isAllDay?: boolean;
  recurringEventId?: string;
  rawData?: Record<string, unknown>;
}

export interface UpdateMeetingInput extends Partial<CreateMeetingInput> {
  id?: string;
}

export interface MeetingFilterOptions {
  calendarIds?: string[];
  sources?: MeetingSource[];
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  searchQuery?: string;
  status?: MeetingStatus[];
  limit?: number;
  offset?: number;
}
