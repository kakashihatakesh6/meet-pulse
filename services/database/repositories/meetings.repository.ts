import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import {
  Meeting,
  MeetingWithAlarms,
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingFilterOptions,
} from '../../../types/meeting';
import { Alarm } from '../../../types/alarm';
import { getDayBoundariesInTz } from '../../../utils/timezone';
import { computeMeetingStatus } from '../../../utils/dates';
import { identifyPlatform } from '../../../utils/meeting-url';

interface DbMeetingRow {
  id: string;
  google_event_id: string | null;
  calendar_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  platform: string;
  organizer_name: string | null;
  organizer_email: string | null;
  attendees: string;
  source: string;
  status: string;
  is_all_day: number;
  recurring_event_id: string | null;
  raw_data: string | null;
  created_at: string;
  updated_at: string;
}

interface DbAlarmRow {
  id: string;
  meeting_id: string;
  offset_minutes: number;
  scheduled_time: string;
  notification_id: string | null;
  status: string;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

function mapRowToMeeting(row: DbMeetingRow): Meeting {
  let attendees = [];
  try {
    attendees = JSON.parse(row.attendees || '[]');
  } catch {
    attendees = [];
  }

  let rawData = undefined;
  try {
    if (row.raw_data) rawData = JSON.parse(row.raw_data);
  } catch {
    // ignore
  }

  const status = computeMeetingStatus(
    row.start_time,
    row.end_time,
    row.status as Meeting['status']
  );

  return {
    id: row.id,
    googleEventId: row.google_event_id || undefined,
    calendarId: row.calendar_id,
    title: row.title,
    description: row.description || undefined,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    location: row.location || undefined,
    meetingUrl: row.meeting_url || undefined,
    platform: (row.platform as Meeting['platform']) || 'none',
    organizerName: row.organizer_name || undefined,
    organizerEmail: row.organizer_email || undefined,
    attendees,
    source: row.source as Meeting['source'],
    status,
    isAllDay: row.is_all_day === 1,
    recurringEventId: row.recurring_event_id || undefined,
    rawData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToAlarm(row: DbAlarmRow): Alarm {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    offsetMinutes: row.offset_minutes,
    scheduledTime: row.scheduled_time,
    notificationId: row.notification_id || undefined,
    status: row.status as Alarm['status'],
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const MeetingsRepository = {
  /**
   * Retrieves a single meeting by internal UUID
   */
  async getById(id: string): Promise<MeetingWithAlarms | null> {
    const db = await getDatabase();
    const meetingRow = await db.getFirstAsync<DbMeetingRow>(
      'SELECT * FROM meetings WHERE id = ?',
      [id]
    );

    if (!meetingRow) return null;

    const alarmRows = await db.getAllAsync<DbAlarmRow>(
      'SELECT * FROM alarms WHERE meeting_id = ? ORDER BY offset_minutes ASC',
      [id]
    );

    const meeting = mapRowToMeeting(meetingRow);
    const alarms = alarmRows.map(mapRowToAlarm);

    return { ...meeting, alarms };
  },

  /**
   * Retrieves meeting by external Google Event ID
   */
  async getByGoogleEventId(googleEventId: string): Promise<Meeting | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DbMeetingRow>(
      'SELECT * FROM meetings WHERE google_event_id = ?',
      [googleEventId]
    );
    return row ? mapRowToMeeting(row) : null;
  },

  /**
   * Inserts or updates a meeting from Google Calendar sync
   */
  async upsertGoogleMeeting(input: CreateMeetingInput): Promise<Meeting> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const existing = input.googleEventId
      ? await this.getByGoogleEventId(input.googleEventId)
      : null;

    const id = existing ? existing.id : Crypto.randomUUID();
    const platform = input.platform || identifyPlatform(input.meetingUrl);

    await db.runAsync(
      `INSERT INTO meetings (
        id, google_event_id, calendar_id, title, description, start_time, end_time,
        timezone, location, meeting_url, platform, organizer_name, organizer_email,
        attendees, source, status, is_all_day, recurring_event_id, raw_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(google_event_id) DO UPDATE SET
        calendar_id = excluded.calendar_id,
        title = excluded.title,
        description = excluded.description,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        timezone = excluded.timezone,
        location = excluded.location,
        meeting_url = excluded.meeting_url,
        platform = excluded.platform,
        organizer_name = excluded.organizer_name,
        organizer_email = excluded.organizer_email,
        attendees = excluded.attendees,
        status = excluded.status,
        is_all_day = excluded.is_all_day,
        recurring_event_id = excluded.recurring_event_id,
        raw_data = excluded.raw_data,
        updated_at = excluded.updated_at`,
      [
        id,
        input.googleEventId || null,
        input.calendarId || 'primary',
        input.title,
        input.description || null,
        input.startTime,
        input.endTime,
        input.timezone || 'UTC',
        input.location || null,
        input.meetingUrl || null,
        platform,
        input.organizerName || null,
        input.organizerEmail || null,
        JSON.stringify(input.attendees || []),
        'google_calendar',
        input.status || 'upcoming',
        input.isAllDay ? 1 : 0,
        input.recurringEventId || null,
        input.rawData ? JSON.stringify(input.rawData) : null,
        existing ? existing.createdAt : now,
        now,
      ]
    );

    const result = await this.getById(id);
    if (!result) throw new Error(`Failed to retrieve upserted meeting ${id}`);
    return result;
  },

  /**
   * Creates an imported meeting (source = 'imported')
   */
  async createImportedMeeting(input: CreateMeetingInput): Promise<Meeting> {
    const db = await getDatabase();
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    const platform = input.platform || identifyPlatform(input.meetingUrl);

    await db.runAsync(
      `INSERT INTO meetings (
        id, google_event_id, calendar_id, title, description, start_time, end_time,
        timezone, location, meeting_url, platform, organizer_name, organizer_email,
        attendees, source, status, is_all_day, recurring_event_id, raw_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        null,
        input.calendarId || 'imported',
        input.title,
        input.description || null,
        input.startTime,
        input.endTime,
        input.timezone || 'UTC',
        input.location || null,
        input.meetingUrl || null,
        platform,
        input.organizerName || null,
        input.organizerEmail || null,
        JSON.stringify(input.attendees || []),
        'imported',
        input.status || 'upcoming',
        input.isAllDay ? 1 : 0,
        null,
        input.rawData ? JSON.stringify(input.rawData) : null,
        now,
        now,
      ]
    );

    const meeting = await this.getById(id);
    if (!meeting) throw new Error('Failed to create imported meeting');
    return meeting;
  },

  /**
   * Batch creates imported meetings inside a single fast SQLite transaction
   */
  async batchInsertImportedMeetings(meetingsList: CreateMeetingInput[]): Promise<Meeting[]> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const createdMeetings: Meeting[] = [];

    await db.withTransactionAsync(async () => {
      for (const input of meetingsList) {
        const id = Crypto.randomUUID();
        const platform = input.platform || identifyPlatform(input.meetingUrl);

        await db.runAsync(
          `INSERT INTO meetings (
            id, google_event_id, calendar_id, title, description, start_time, end_time,
            timezone, location, meeting_url, platform, organizer_name, organizer_email,
            attendees, source, status, is_all_day, recurring_event_id, raw_data, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            null,
            input.calendarId || 'imported',
            input.title,
            input.description || null,
            input.startTime,
            input.endTime,
            input.timezone || 'UTC',
            input.location || null,
            input.meetingUrl || null,
            platform,
            input.organizerName || null,
            input.organizerEmail || null,
            JSON.stringify(input.attendees || []),
            'imported',
            input.status || 'upcoming',
            input.isAllDay ? 1 : 0,
            null,
            input.rawData ? JSON.stringify(input.rawData) : null,
            now,
            now,
          ]
        );

        createdMeetings.push({
          id,
          calendarId: input.calendarId || 'imported',
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone || 'UTC',
          location: input.location,
          meetingUrl: input.meetingUrl,
          platform,
          organizerName: input.organizerName,
          organizerEmail: input.organizerEmail,
          attendees: input.attendees || [],
          source: 'imported',
          status: (input.status as Meeting['status']) || 'upcoming',
          isAllDay: !!input.isAllDay,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    return createdMeetings;
  },

  /**
   * Retrieves today's meetings with their alarms in chronological order
   */
  async getTodayMeetings(timezone?: string): Promise<MeetingWithAlarms[]> {
    const bounds = getDayBoundariesInTz(new Date(), timezone);
    return this.getMeetingsByDateRange(bounds.startIso, bounds.endIso);
  },

  /**
   * Retrieves upcoming meetings starting from right now (or beginning of current day)
   */
  async getUpcomingMeetings(limit: number = 50): Promise<MeetingWithAlarms[]> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    const meetingRows = await db.getAllAsync<DbMeetingRow>(
      `SELECT m.* FROM meetings m
       LEFT JOIN calendars c ON (m.calendar_id = c.google_calendar_id OR m.calendar_id = c.id)
       WHERE (c.is_enabled IS NULL OR c.is_enabled = 1 OR c.primary_cal = 1)
         AND m.end_time >= ?
         AND m.status != 'cancelled'
       ORDER BY m.start_time ASC
       LIMIT ?`,
      [nowIso, limit]
    );

    const seenIds = new Set<string>();
    const result: MeetingWithAlarms[] = [];
    for (const row of meetingRows) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      const alarmRows = await db.getAllAsync<DbAlarmRow>(
        'SELECT * FROM alarms WHERE meeting_id = ? ORDER BY offset_minutes ASC',
        [row.id]
      );
      result.push({
        ...mapRowToMeeting(row),
        alarms: alarmRows.map(mapRowToAlarm),
      });
    }

    return result;
  },

  /**
   * Retrieves meetings within a specific date range with optional source/calendar filters
   */
  async getMeetingsByDateRange(
    startDateIso: string,
    endDateIso: string,
    filter?: MeetingFilterOptions
  ): Promise<MeetingWithAlarms[]> {
    const db = await getDatabase();
    const conditions: string[] = [
      '((m.start_time <= ? AND m.end_time >= ?) OR (m.start_time >= ? AND m.start_time <= ?) OR (m.end_time >= ? AND m.end_time <= ?))',
      '(c.is_enabled IS NULL OR c.is_enabled = 1 OR c.primary_cal = 1)',
    ];
    const params: (string | number)[] = [
      endDateIso,
      startDateIso,
      startDateIso,
      endDateIso,
      startDateIso,
      endDateIso,
    ];

    if (filter?.sources && filter.sources.length > 0) {
      const placeholders = filter.sources.map(() => '?').join(',');
      conditions.push(`m.source IN (${placeholders})`);
      params.push(...filter.sources);
    }

    if (filter?.searchQuery) {
      conditions.push('(m.title LIKE ? OR m.description LIKE ? OR m.location LIKE ?)');
      const q = `%${filter.searchQuery}%`;
      params.push(q, q, q);
    }

    const query = `
      SELECT m.* FROM meetings m
      LEFT JOIN calendars c ON (m.calendar_id = c.google_calendar_id OR m.calendar_id = c.id)
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.start_time ASC
    `;

    const meetingRows = await db.getAllAsync<DbMeetingRow>(query, params);
    const seenIds = new Set<string>();
    const result: MeetingWithAlarms[] = [];

    for (const row of meetingRows) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      const alarmRows = await db.getAllAsync<DbAlarmRow>(
        'SELECT * FROM alarms WHERE meeting_id = ? ORDER BY offset_minutes ASC',
        [row.id]
      );
      result.push({
        ...mapRowToMeeting(row),
        alarms: alarmRows.map(mapRowToAlarm),
      });
    }

    return result;
  },

  /**
   * Full search query across titles, descriptions, and locations
   */
  async searchMeetings(searchQuery: string, limit: number = 100): Promise<MeetingWithAlarms[]> {
    const db = await getDatabase();
    const q = `%${searchQuery}%`;
    const meetingRows = await db.getAllAsync<DbMeetingRow>(
      `SELECT m.* FROM meetings m
       LEFT JOIN calendars c ON (m.calendar_id = c.google_calendar_id OR m.calendar_id = c.id)
       WHERE (c.is_enabled IS NULL OR c.is_enabled = 1 OR c.primary_cal = 1)
         AND (m.title LIKE ? OR m.description LIKE ? OR m.location LIKE ?)
       ORDER BY m.start_time DESC
       LIMIT ?`,
      [q, q, q, limit]
    );

    const seenIds = new Set<string>();
    const result: MeetingWithAlarms[] = [];
    for (const row of meetingRows) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      const alarmRows = await db.getAllAsync<DbAlarmRow>(
        'SELECT * FROM alarms WHERE meeting_id = ? ORDER BY offset_minutes ASC',
        [row.id]
      );
      result.push({
        ...mapRowToMeeting(row),
        alarms: alarmRows.map(mapRowToAlarm),
      });
    }

    return result;
  },

  /**
   * Updates an existing meeting
   */
  async updateMeeting(id: string, input: UpdateMeetingInput): Promise<MeetingWithAlarms | null> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description || null);
    }
    if (input.startTime !== undefined) {
      updates.push('start_time = ?');
      params.push(input.startTime);
    }
    if (input.endTime !== undefined) {
      updates.push('end_time = ?');
      params.push(input.endTime);
    }
    if (input.location !== undefined) {
      updates.push('location = ?');
      params.push(input.location || null);
    }
    if (input.meetingUrl !== undefined) {
      updates.push('meeting_url = ?');
      params.push(input.meetingUrl || null);
      updates.push('platform = ?');
      params.push(identifyPlatform(input.meetingUrl));
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }

    params.push(id);
    await db.runAsync(`UPDATE meetings SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.getById(id);
  },

  /**
   * Deletes an imported meeting and cascades to alarms
   */
  async deleteImportedMeeting(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      "DELETE FROM meetings WHERE id = ? AND source = 'imported'",
      [id]
    );
    return result.changes > 0;
  },

  /**
   * Clears all imported meetings
   */
  async clearAllImportedMeetings(): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync("DELETE FROM meetings WHERE source = 'imported'");
    return result.changes;
  },

  /**
   * Clears all meetings (for reset / sign out)
   */
  async clearAllMeetings(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM meetings');
  },

  /**
   * Total meeting count
   */
  async getCounts(): Promise<{ total: number; today: number; google: number; imported: number }> {
    const db = await getDatabase();
    const totalRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM meetings');
    const googleRow = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM meetings WHERE source = 'google_calendar'");
    const importedRow = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM meetings WHERE source = 'imported'");

    const bounds = getDayBoundariesInTz(new Date());
    const todayRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM meetings WHERE start_time <= ? AND end_time >= ?',
      [bounds.endIso, bounds.startIso]
    );

    return {
      total: totalRow?.count || 0,
      today: todayRow?.count || 0,
      google: googleRow?.count || 0,
      imported: importedRow?.count || 0,
    };
  },
};
