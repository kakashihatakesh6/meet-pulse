import { getDatabase } from '../database';
import { AppSettings, DEFAULT_SETTINGS } from '../../../types/settings';

export const SettingsRepository = {
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  },

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), now]
    );
  },

  async getAllSettings(): Promise<AppSettings> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM settings'
    );

    const result: Partial<AppSettings> = {};
    for (const row of rows) {
      try {
        result[row.key as keyof AppSettings] = JSON.parse(row.value);
      } catch {
        // ignore
      }
    }

    return { ...DEFAULT_SETTINGS, ...result };
  },

  async saveAllSettings(settings: AppSettings): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const [key, value] of Object.entries(settings)) {
        await db.runAsync(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, JSON.stringify(value), now]
        );
      }
    });
  },
};
