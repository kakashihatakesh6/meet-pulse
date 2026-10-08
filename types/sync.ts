export interface SyncMetadata {
  calendarId: string;
  syncToken?: string;
  lastSyncTimestamp: string;
  status: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export interface SyncResult {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  alarmsScheduledCount: number;
  syncTimestamp: string;
  error?: string;
  isOffline?: boolean;
}
