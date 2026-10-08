export type SpreadsheetRow = Record<string, unknown>;

export interface ColumnMapping {
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  duration?: string;
  meetingUrl?: string;
  description?: string;
  location?: string;
  alarmOffset?: string;
  organizerName?: string;
  organizerEmail?: string;
}

export type ImportRowStatus = 'valid' | 'warning' | 'error';

export interface ParsedMeetingRow {
  rowIndex: number;
  raw: SpreadsheetRow;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  meetingUrl?: string;
  description?: string;
  location?: string;
  alarmOffsetMinutes?: number;
  organizerName?: string;
  organizerEmail?: string;
  // Computed timestamps
  computedStartIso?: string;
  computedEndIso?: string;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  isSelected: boolean;
}

export interface SpreadsheetParseResult {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rawRows: SpreadsheetRow[];
  suggestedMapping: ColumnMapping;
}

export interface GoogleDriveSpreadsheet {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}
