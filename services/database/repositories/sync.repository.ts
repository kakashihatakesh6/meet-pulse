import { getDatabase } from '../database';
import { SyncMetadata } from '../../../types/sync';

interface DbSyncRow {
  calendar_id: string;
  sync_token: string | null;
  last_sync_timestamp: string;
  status: string;
  error_message: string | null;
}

function mapRowToSyncMetadata(row: DbSyncRow): SyncMetadata {
  return {
    calendarId: row.calendar_id,
    syncToken: row.sync_token || undefined,
    lastSyncTimestamp: row.last_sync_timestamp,
    status: row.status as SyncMetadata['status'],
    errorMessage: row.error_message || undefined,
  };
}

export const SyncRepository = {
  async get(calendarId: string): Promise<SyncMetadata | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DbSyncRow>(
      'SELECT * FROM sync_metadata WHERE calendar_id = ?',
      [calendarId]
    );
    return row ? mapRowToSyncMetadata(row) : null;
  },

  async getAll(): Promise<SyncMetadata[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DbSyncRow>('SELECT * FROM sync_metadata');
    return rows.map(mapRowToSyncMetadata);
  },

  async set(metadata: SyncMetadata): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_metadata (calendar_id, sync_token, last_sync_timestamp, status, error_message)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(calendar_id) DO UPDATE SET
         sync_token = excluded.sync_token,
         last_sync_timestamp = excluded.last_sync_timestamp,
         status = excluded.status,
         error_message = excluded.error_message`,
      [
        metadata.calendarId,
        metadata.syncToken || null,
        metadata.lastSyncTimestamp,
        metadata.status,
        metadata.errorMessage || null,
      ]
    );
  },

  async updateStatus(
    calendarId: string,
    status: SyncMetadata['status'],
    errorMessage?: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sync_metadata (calendar_id, last_sync_timestamp, status, error_message)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(calendar_id) DO UPDATE SET
         last_sync_timestamp = excluded.last_sync_timestamp,
         status = excluded.status,
         error_message = excluded.error_message`,
      [calendarId, now, status, errorMessage || null]
    );
  },

  async clear(calendarId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM sync_metadata WHERE calendar_id = ?', [calendarId]);
  },

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM sync_metadata');
  },
};
