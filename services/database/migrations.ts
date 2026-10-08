import { DatabaseInstance } from './web-database';
import { logger } from '../../utils/logger';

export async function runMigrations(db: DatabaseInstance): Promise<void> {
  logger.info('Running database schema setup and migrations...');

  await db.execAsync(`
    -- Schema Version Tracker
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      given_name TEXT,
      family_name TEXT,
      picture TEXT,
      last_login_at TEXT NOT NULL
    );

    -- Calendars Table
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      google_calendar_id TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      description TEXT,
      primary_cal INTEGER NOT NULL DEFAULT 0,
      background_color TEXT NOT NULL DEFAULT '#4F46E5',
      foreground_color TEXT NOT NULL DEFAULT '#FFFFFF',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      access_role TEXT NOT NULL DEFAULT 'reader',
      timezone TEXT,
      last_synced_at TEXT
    );

    -- Meetings Table
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      google_event_id TEXT UNIQUE,
      calendar_id TEXT NOT NULL DEFAULT 'primary',
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      location TEXT,
      meeting_url TEXT,
      platform TEXT NOT NULL DEFAULT 'none',
      organizer_name TEXT,
      organizer_email TEXT,
      attendees TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'google_calendar',
      status TEXT NOT NULL DEFAULT 'upcoming',
      is_all_day INTEGER NOT NULL DEFAULT 0,
      recurring_event_id TEXT,
      raw_data TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Alarms Table
    CREATE TABLE IF NOT EXISTS alarms (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      offset_minutes INTEGER NOT NULL,
      scheduled_time TEXT NOT NULL,
      notification_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      UNIQUE(meeting_id, offset_minutes)
    );

    -- App Settings Key-Value Store
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Calendar Sync Metadata
    CREATE TABLE IF NOT EXISTS sync_metadata (
      calendar_id TEXT PRIMARY KEY,
      sync_token TEXT,
      last_sync_timestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      error_message TEXT
    );

    -- Indices for high performance queries
    CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);
    CREATE INDEX IF NOT EXISTS idx_meetings_calendar_id ON meetings(calendar_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_source ON meetings(source);
    CREATE INDEX IF NOT EXISTS idx_meetings_google_event_id ON meetings(google_event_id);
    CREATE INDEX IF NOT EXISTS idx_alarms_meeting_id ON alarms(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_alarms_scheduled_time ON alarms(scheduled_time);
    CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);
  `);

  logger.info('Database schema setup completed successfully');
}
