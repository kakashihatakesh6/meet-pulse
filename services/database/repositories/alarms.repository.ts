import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { Alarm, CreateAlarmInput, UpdateAlarmInput, AlarmWithMeeting } from '../../../types/alarm';
import { Meeting } from '../../../types/meeting';

export type { AlarmWithMeeting };

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

export const AlarmsRepository = {
  async getById(id: string): Promise<Alarm | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DbAlarmRow>(
      'SELECT * FROM alarms WHERE id = ?',
      [id]
    );
    return row ? mapRowToAlarm(row) : null;
  },

  async getByMeetingId(meetingId: string): Promise<Alarm[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DbAlarmRow>(
      'SELECT * FROM alarms WHERE meeting_id = ? ORDER BY offset_minutes ASC',
      [meetingId]
    );
    const seen = new Set<string>();
    const result: Alarm[] = [];
    for (const r of rows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        result.push(mapRowToAlarm(r));
      }
    }
    return result;
  },

  async getByMeetingAndOffset(meetingId: string, offsetMinutes: number): Promise<Alarm | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DbAlarmRow>(
      'SELECT * FROM alarms WHERE meeting_id = ? AND offset_minutes = ?',
      [meetingId, offsetMinutes]
    );
    return row ? mapRowToAlarm(row) : null;
  },

  /**
   * Retrieves all upcoming enabled alarms with meeting details
   */
  async getUpcomingAlarmsWithMeetings(limit: number = 50): Promise<AlarmWithMeeting[]> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    const rows = await db.getAllAsync<{
      // Alarm fields
      a_id: string;
      a_meeting_id: string;
      a_offset_minutes: number;
      a_scheduled_time: string;
      a_notification_id: string | null;
      a_status: string;
      a_is_enabled: number;
      a_created_at: string;
      a_updated_at: string;
      // Meeting fields
      m_id: string;
      m_google_event_id: string | null;
      m_calendar_id: string;
      m_title: string;
      m_description: string | null;
      m_start_time: string;
      m_end_time: string;
      m_timezone: string;
      m_location: string | null;
      m_meeting_url: string | null;
      m_platform: string;
      m_organizer_name: string | null;
      m_organizer_email: string | null;
      m_attendees: string;
      m_source: string;
      m_status: string;
      m_is_all_day: number;
      m_created_at: string;
      m_updated_at: string;
    }>(
      `SELECT
        a.id as a_id, a.meeting_id as a_meeting_id, a.offset_minutes as a_offset_minutes,
        a.scheduled_time as a_scheduled_time, a.notification_id as a_notification_id,
        a.status as a_status, a.is_enabled as a_is_enabled, a.created_at as a_created_at,
        a.updated_at as a_updated_at,
        m.id as m_id, m.google_event_id as m_google_event_id, m.calendar_id as m_calendar_id,
        m.title as m_title, m.description as m_description, m.start_time as m_start_time,
        m.end_time as m_end_time, m.timezone as m_timezone, m.location as m_location,
        m.meeting_url as m_meeting_url, m.platform as m_platform, m.organizer_name as m_organizer_name,
        m.organizer_email as m_organizer_email, m.attendees as m_attendees, m.source as m_source,
        m.status as m_status, m.is_all_day as m_is_all_day, m.created_at as m_created_at,
        m.updated_at as m_updated_at
      FROM alarms a
      INNER JOIN meetings m ON a.meeting_id = m.id
      WHERE a.is_enabled = 1
        AND a.scheduled_time >= ?
        AND m.status != 'cancelled'
      ORDER BY a.scheduled_time ASC
      LIMIT ?`,
      [nowIso, limit]
    );

    const seenIds = new Set<string>();
    const result: AlarmWithMeeting[] = [];

    for (const r of rows) {
      if (seenIds.has(r.a_id)) continue;
      seenIds.add(r.a_id);

      result.push({
        id: r.a_id,
        meetingId: r.a_meeting_id,
        offsetMinutes: r.a_offset_minutes,
        scheduledTime: r.a_scheduled_time,
        notificationId: r.a_notification_id || undefined,
        status: r.a_status as Alarm['status'],
        isEnabled: r.a_is_enabled === 1,
        createdAt: r.a_created_at,
        updatedAt: r.a_updated_at,
        meeting: {
          id: r.m_id,
          googleEventId: r.m_google_event_id || undefined,
          calendarId: r.m_calendar_id,
          title: r.m_title,
          description: r.m_description || undefined,
          startTime: r.m_start_time,
          endTime: r.m_end_time,
          timezone: r.m_timezone,
          location: r.m_location || undefined,
          meetingUrl: r.m_meeting_url || undefined,
          platform: (r.m_platform as Meeting['platform']) || 'none',
          organizerName: r.m_organizer_name || undefined,
          organizerEmail: r.m_organizer_email || undefined,
          attendees: JSON.parse(r.m_attendees || '[]'),
          source: r.m_source as Meeting['source'],
          status: r.m_status as Meeting['status'],
          isAllDay: r.m_is_all_day === 1,
          createdAt: r.m_created_at,
          updatedAt: r.m_updated_at,
        },
      });
    }

    return result;
  },

  async upsert(input: CreateAlarmInput): Promise<Alarm> {
    const db = await getDatabase();
    const existing = await this.getByMeetingAndOffset(input.meetingId, input.offsetMinutes);
    const id = existing ? existing.id : Crypto.randomUUID();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO alarms (
        id, meeting_id, offset_minutes, scheduled_time, notification_id,
        status, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(meeting_id, offset_minutes) DO UPDATE SET
        scheduled_time = excluded.scheduled_time,
        notification_id = excluded.notification_id,
        status = excluded.status,
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at`,
      [
        id,
        input.meetingId,
        input.offsetMinutes,
        input.scheduledTime || now,
        input.notificationId || null,
        'pending',
        input.isEnabled !== undefined ? (input.isEnabled ? 1 : 0) : 1,
        existing ? existing.createdAt : now,
        now,
      ]
    );

    const result = await this.getById(id);
    if (!result) throw new Error(`Failed to upsert alarm ${id}`);
    return result;
  },

  async update(id: string, input: UpdateAlarmInput): Promise<Alarm | null> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (input.scheduledTime !== undefined) {
      updates.push('scheduled_time = ?');
      params.push(input.scheduledTime);
    }
    if (input.notificationId !== undefined) {
      updates.push('notification_id = ?');
      params.push(input.notificationId);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.isEnabled !== undefined) {
      updates.push('is_enabled = ?');
      params.push(input.isEnabled ? 1 : 0);
    }

    params.push(id);
    await db.runAsync(`UPDATE alarms SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM alarms WHERE id = ?', [id]);
    return result.changes > 0;
  },

  async deleteByMeetingId(meetingId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM alarms WHERE meeting_id = ?', [meetingId]);
    return result.changes;
  },

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM alarms');
  },
};
