import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { CalendarEntity } from '../../../types/calendar';

interface DbCalendarRow {
  id: string;
  google_calendar_id: string;
  summary: string;
  description: string | null;
  primary_cal: number;
  background_color: string;
  foreground_color: string;
  is_enabled: number;
  access_role: string;
  timezone: string | null;
  last_synced_at: string | null;
}

function mapRowToCalendar(row: DbCalendarRow): CalendarEntity {
  return {
    id: row.id,
    googleCalendarId: row.google_calendar_id,
    summary: row.summary,
    description: row.description || undefined,
    primary: row.primary_cal === 1,
    backgroundColor: row.background_color,
    foregroundColor: row.foreground_color,
    isEnabled: row.is_enabled === 1,
    accessRole: (row.access_role as CalendarEntity['accessRole']) || 'reader',
    timeZone: row.timezone || undefined,
    lastSyncedAt: row.last_synced_at || undefined,
  };
}

export const CalendarsRepository = {
  async getAll(): Promise<CalendarEntity[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DbCalendarRow>(
      'SELECT * FROM calendars ORDER BY primary_cal DESC, summary ASC'
    );
    const seen = new Set<string>();
    const result: CalendarEntity[] = [];
    for (const r of rows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        result.push(mapRowToCalendar(r));
      }
    }
    return result;
  },

  async getEnabled(): Promise<CalendarEntity[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DbCalendarRow>(
      'SELECT * FROM calendars WHERE is_enabled = 1 OR primary_cal = 1 ORDER BY primary_cal DESC, summary ASC'
    );
    const targetRows = rows.length > 0 ? rows : await db.getAllAsync<DbCalendarRow>(
      'SELECT * FROM calendars ORDER BY primary_cal DESC, summary ASC'
    );
    const seen = new Set<string>();
    const result: CalendarEntity[] = [];
    for (const r of targetRows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        result.push(mapRowToCalendar(r));
      }
    }
    return result;
  },

  async getByGoogleId(googleCalendarId: string): Promise<CalendarEntity | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DbCalendarRow>(
      'SELECT * FROM calendars WHERE google_calendar_id = ?',
      [googleCalendarId]
    );
    return row ? mapRowToCalendar(row) : null;
  },

  async upsert(calendar: Omit<CalendarEntity, 'id'> & { id?: string }): Promise<CalendarEntity> {
    const db = await getDatabase();
    const existing = await this.getByGoogleId(calendar.googleCalendarId);
    const id = existing ? existing.id : calendar.id || Crypto.randomUUID();
    const isEnabledVal = existing ? (existing.isEnabled ? 1 : 0) : (calendar.isEnabled === false ? 0 : 1);

    await db.runAsync(
      `INSERT INTO calendars (
        id, google_calendar_id, summary, description, primary_cal,
        background_color, foreground_color, is_enabled, access_role, timezone, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(google_calendar_id) DO UPDATE SET
        summary = excluded.summary,
        description = excluded.description,
        primary_cal = CASE WHEN excluded.primary_cal = 1 THEN 1 ELSE calendars.primary_cal END,
        background_color = excluded.background_color,
        foreground_color = excluded.foreground_color,
        access_role = excluded.access_role,
        timezone = excluded.timezone,
        last_synced_at = excluded.last_synced_at`,
      [
        id,
        calendar.googleCalendarId,
        calendar.summary,
        calendar.description || null,
        calendar.primary ? 1 : 0,
        calendar.backgroundColor || '#4F46E5',
        calendar.foregroundColor || '#FFFFFF',
        isEnabledVal,
        calendar.accessRole || 'reader',
        calendar.timeZone || null,
        calendar.lastSyncedAt || null,
      ]
    );

    const result = await this.getByGoogleId(calendar.googleCalendarId);
    if (!result) throw new Error(`Failed to upsert calendar ${calendar.googleCalendarId}`);
    return result;
  },

  async batchUpsert(calendars: Array<Omit<CalendarEntity, 'id'>>): Promise<CalendarEntity[]> {
    const results: CalendarEntity[] = [];
    for (const cal of calendars) {
      const saved = await this.upsert(cal);
      results.push(saved);
    }
    return results;
  },

  async toggleEnabled(id: string, isEnabled: boolean): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      'UPDATE calendars SET is_enabled = ? WHERE id = ?',
      [isEnabled ? 1 : 0, id]
    );
    return result.changes > 0;
  },

  async updateLastSynced(googleCalendarId: string, timestampIso: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE calendars SET last_synced_at = ? WHERE google_calendar_id = ?',
      [timestampIso, googleCalendarId]
    );
  },

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM calendars');
  },
};
