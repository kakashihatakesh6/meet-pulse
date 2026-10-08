import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { SQLITE_DB_NAME } from '../../constants/storage';
import { runMigrations } from './migrations';
import { WebSqliteDatabase, DatabaseInstance } from './web-database';
import { logger } from '../../utils/logger';

export type { DatabaseInstance };

let dbInstance: DatabaseInstance | null = null;
let initPromise: Promise<DatabaseInstance> | null = null;

/**
 * Returns the singleton initialized SQLite Database instance
 */
export async function getDatabase(): Promise<DatabaseInstance> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      logger.info(`Opening SQLite database: ${SQLITE_DB_NAME} (Platform: ${Platform.OS})`);

      let db: DatabaseInstance;

      if (Platform.OS === 'web') {
        db = new WebSqliteDatabase(SQLITE_DB_NAME);
      } else {
        try {
          const nativeDb = await SQLite.openDatabaseAsync(SQLITE_DB_NAME);
          // Enable WAL mode for high concurrent read performance & foreign keys on native
          try {
            await nativeDb.execAsync('PRAGMA journal_mode = WAL;');
            await nativeDb.execAsync('PRAGMA foreign_keys = ON;');
          } catch (pragmaErr) {
            logger.warn('SQLite PRAGMA warning', pragmaErr);
          }
          db = nativeDb as unknown as DatabaseInstance;
        } catch (nativeErr) {
          logger.warn('Native SQLite unavailable, falling back to Web SQLite', nativeErr);
          db = new WebSqliteDatabase(SQLITE_DB_NAME);
        }
      }

      // Execute schema migrations
      await runMigrations(db);

      dbInstance = db;
      return db;
    } catch (err) {
      logger.error('Failed to initialize SQLite database', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}
