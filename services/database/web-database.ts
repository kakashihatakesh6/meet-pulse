import { logger } from '../../utils/logger';

export interface DatabaseResult {
  changes: number;
  lastInsertRowId: number;
}

export interface DatabaseInstance {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: (string | number | boolean | null)[]): Promise<DatabaseResult>;
  getFirstAsync<T>(sql: string, params?: (string | number | boolean | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: (string | number | boolean | null)[]): Promise<T[]>;
  withTransactionAsync<T>(fn: () => Promise<T>): Promise<T>;
}

type Row = Record<string, any>;

export class WebSqliteDatabase implements DatabaseInstance {
  private dbName: string;
  private tables: Map<string, Row[]> = new Map();
  private isLoaded: boolean = false;

  constructor(dbName: string) {
    this.dbName = dbName;
    this.loadFromStorage();
  }

  private getStorageKey(tableName: string): string {
    return `meetpulse_db_${this.dbName}_${tableName}`;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      this.isLoaded = true;
      return;
    }

    const tableNames = [
      'schema_version',
      'users',
      'calendars',
      'meetings',
      'alarms',
      'settings',
      'sync_metadata',
    ];

    for (const name of tableNames) {
      try {
        const raw = window.localStorage.getItem(this.getStorageKey(name));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const seen = new Set<any>();
            const deduplicated: Row[] = [];
            for (const r of parsed) {
              if (r && r.id !== undefined && r.id !== null) {
                if (!seen.has(r.id)) {
                  seen.add(r.id);
                  deduplicated.push(r);
                }
              } else {
                deduplicated.push(r);
              }
            }
            this.tables.set(name, deduplicated);
          }
        }
      } catch (err) {
        logger.warn(`Failed to load web table ${name}`, err);
      }
    }
    this.isLoaded = true;
  }

  private saveTable(tableName: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const rows = this.tables.get(tableName) || [];
      window.localStorage.setItem(this.getStorageKey(tableName), JSON.stringify(rows));
    } catch (err) {
      logger.warn(`Failed to save web table ${tableName}`, err);
    }
  }

  private getTable(tableName: string): Row[] {
    const cleanName = tableName.trim().toLowerCase();
    if (!this.tables.has(cleanName)) {
      this.tables.set(cleanName, []);
    }
    return this.tables.get(cleanName)!;
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await this.runAsync(statement);
    }
  }

  async withTransactionAsync<T>(fn: () => Promise<T>): Promise<T> {
    return await fn();
  }

  async runAsync(
    sql: string,
    params: (string | number | boolean | null)[] = []
  ): Promise<DatabaseResult> {
    const trimmed = sql.trim();

    if (/^PRAGMA/i.test(trimmed) || /^CREATE\s+INDEX/i.test(trimmed)) {
      return { changes: 0, lastInsertRowId: 0 };
    }

    if (/^CREATE\s+TABLE/i.test(trimmed)) {
      const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    if (/^INSERT\s+INTO/i.test(trimmed)) {
      return this.handleInsert(trimmed, params);
    }

    if (/^UPDATE/i.test(trimmed)) {
      return this.handleUpdate(trimmed, params);
    }

    if (/^DELETE\s+FROM/i.test(trimmed)) {
      return this.handleDelete(trimmed, params);
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  async getFirstAsync<T>(
    sql: string,
    params: (string | number | boolean | null)[] = []
  ): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all.length > 0 ? all[0] : null;
  }

  async getAllAsync<T>(
    sql: string,
    params: (string | number | boolean | null)[] = []
  ): Promise<T[]> {
    const trimmed = sql.trim();
    if (!/^SELECT/i.test(trimmed)) {
      return [];
    }

    return this.handleSelect<T>(trimmed, params);
  }

  private handleInsert(
    sql: string,
    params: (string | number | boolean | null)[]
  ): DatabaseResult {
    const insertMatch = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(.*)/is);
    if (!insertMatch) {
      logger.warn('Web SQLite: Unmatched INSERT statement', sql);
      return { changes: 0, lastInsertRowId: 0 };
    }

    const tableName = insertMatch[1].toLowerCase();
    const columns = insertMatch[2].split(',').map((c) => c.trim().toLowerCase());
    const rest = insertMatch[4] || '';

    const newRow: Row = {};
    columns.forEach((col, idx) => {
      newRow[col] = idx < params.length ? params[idx] : null;
    });

    const rows = this.getTable(tableName);

    // Check for ON CONFLICT clause
    const onConflictMatch = rest.match(/ON\s+CONFLICT\s*\(([^)]+)\)\s*DO\s+UPDATE\s+SET\s+(.*)/is);
    if (onConflictMatch) {
      const conflictCols = onConflictMatch[1].split(',').map((c) => c.trim().toLowerCase());
      const updateSetClause = onConflictMatch[2].trim();

      const existingIndex = rows.findIndex((row) =>
        conflictCols.every((col) => row[col] !== undefined && row[col] !== null && String(row[col]) === String(newRow[col]))
      );

      if (existingIndex >= 0) {
        const existingRow = rows[existingIndex];
        const assignments = updateSetClause.split(',').map((a) => a.trim());

        for (const assign of assignments) {
          const assignMatch = assign.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/i);
          if (assignMatch) {
            const col = assignMatch[1].toLowerCase();
            const expr = assignMatch[2].trim();

            if (/^excluded\.([a-zA-Z0-9_]+)$/i.test(expr)) {
              const excludedCol = expr.replace(/^excluded\./i, '').toLowerCase();
              existingRow[col] = newRow[excludedCol];
            } else if (/^CASE\s+WHEN\s+excluded\.primary_cal\s*=\s*1\s+THEN\s+1/i.test(expr)) {
              if (newRow['primary_cal'] === 1) {
                existingRow['primary_cal'] = 1;
              }
            } else {
              if (newRow[col] !== undefined) {
                existingRow[col] = newRow[col];
              }
            }
          }
        }
        this.saveTable(tableName);
        return { changes: 1, lastInsertRowId: existingIndex + 1 };
      }
    } else if (newRow['id'] !== undefined && newRow['id'] !== null) {
      const existingIndex = rows.findIndex((r) => r['id'] === newRow['id']);
      if (existingIndex >= 0) {
        rows[existingIndex] = { ...rows[existingIndex], ...newRow };
        this.saveTable(tableName);
        return { changes: 1, lastInsertRowId: existingIndex + 1 };
      }
    }

    rows.push(newRow);
    this.saveTable(tableName);
    return { changes: 1, lastInsertRowId: rows.length };
  }

  private handleUpdate(
    sql: string,
    params: (string | number | boolean | null)[]
  ): DatabaseResult {
    const updateMatch = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is);
    if (!updateMatch) {
      logger.warn('Web SQLite: Unmatched UPDATE statement', sql);
      return { changes: 0, lastInsertRowId: 0 };
    }

    const tableName = updateMatch[1].toLowerCase();
    const setClause = updateMatch[2].trim();
    const whereClause = updateMatch[3] ? updateMatch[3].trim() : '';

    const rows = this.getTable(tableName);
    let paramIdx = 0;

    const setAssignments = setClause.split(',').map((s) => s.trim());
    const updatesToApply: Array<{ col: string; valueGetter: () => any }> = [];

    for (const assign of setAssignments) {
      const match = assign.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/i);
      if (match) {
        const col = match[1].toLowerCase();
        const expr = match[2].trim();
        if (expr === '?') {
          const p = params[paramIdx++];
          updatesToApply.push({ col, valueGetter: () => p });
        } else {
          updatesToApply.push({ col, valueGetter: () => expr.replace(/^['"]|['"]$/g, '') });
        }
      }
    }

    let updatedCount = 0;
    for (const row of rows) {
      if (!whereClause || this.evaluateWhere(row, whereClause, params, paramIdx)) {
        for (const update of updatesToApply) {
          row[update.col] = update.valueGetter();
        }
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      this.saveTable(tableName);
    }

    return { changes: updatedCount, lastInsertRowId: 0 };
  }

  private handleDelete(
    sql: string,
    params: (string | number | boolean | null)[]
  ): DatabaseResult {
    const deleteMatch = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/is);
    if (!deleteMatch) {
      return { changes: 0, lastInsertRowId: 0 };
    }

    const tableName = deleteMatch[1].toLowerCase();
    const whereClause = deleteMatch[2] ? deleteMatch[2].trim() : '';

    const rows = this.getTable(tableName);
    if (!whereClause) {
      const count = rows.length;
      this.tables.set(tableName, []);
      this.saveTable(tableName);
      return { changes: count, lastInsertRowId: 0 };
    }

    const remaining: Row[] = [];
    let deletedCount = 0;

    for (const row of rows) {
      if (this.evaluateWhere(row, whereClause, params, 0)) {
        deletedCount++;
      } else {
        remaining.push(row);
      }
    }

    this.tables.set(tableName, remaining);
    if (deletedCount > 0) {
      this.saveTable(tableName);
    }

    return { changes: deletedCount, lastInsertRowId: 0 };
  }

  private handleSelect<T>(
    sql: string,
    params: (string | number | boolean | null)[]
  ): T[] {
    // 1. Check for COUNT(*) query
    if (/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i.test(sql)) {
      const countMatch = sql.match(/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?/i)!;
      const tableName = countMatch[1].toLowerCase();
      const whereClause = countMatch[2] ? countMatch[2].trim() : '';
      const rows = this.getTable(tableName);

      if (!whereClause) {
        return [{ count: rows.length } as unknown as T];
      }

      const count = rows.filter((r) => this.evaluateWhere(r, whereClause, params, 0)).length;
      return [{ count } as unknown as T];
    }

    // 2. Standard SELECT from table with optional JOIN, WHERE, ORDER BY, LIMIT
    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)(?:\s+([a-zA-Z0-9_]+))?(.*)/is);
    if (!fromMatch) {
      return [];
    }

    const mainTable = fromMatch[1].toLowerCase();
    const mainAlias = fromMatch[2] ? fromMatch[2].toLowerCase() : mainTable;
    const tail = fromMatch[3] || '';

    let rows = [...this.getTable(mainTable)];

    // Check for JOIN calendars
    const hasCalendarJoin = /LEFT\s+JOIN\s+calendars/i.test(tail);
    const calendarsTable = hasCalendarJoin ? this.getTable('calendars') : [];

    // Check for JOIN meetings in alarms
    const hasMeetingJoin = /INNER\s+JOIN\s+meetings/i.test(tail);
    const meetingsTable = hasMeetingJoin ? this.getTable('meetings') : [];

    // Parse WHERE
    const whereMatch = tail.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/is);
    const whereClause = whereMatch ? whereMatch[1].trim() : '';

    let paramIdx = 0;
    let filtered: Row[] = [];

    for (const row of rows) {
      let combinedRow: Row = { ...row };

      if (hasCalendarJoin) {
        const cal = calendarsTable.find(
          (c) =>
            (row['calendar_id'] && (c['google_calendar_id'] === row['calendar_id'] || c['id'] === row['calendar_id']))
        );
        if (cal) {
          combinedRow['c_is_enabled'] = cal['is_enabled'];
          combinedRow['c_primary_cal'] = cal['primary_cal'];
        } else {
          combinedRow['c_is_enabled'] = null;
          combinedRow['c_primary_cal'] = null;
        }
      }

      if (hasMeetingJoin) {
        const meet = meetingsTable.find((m) => m['id'] === row['meeting_id']);
        if (!meet) continue;
        combinedRow = {
          a_id: row['id'],
          a_meeting_id: row['meeting_id'],
          a_offset_minutes: row['offset_minutes'],
          a_scheduled_time: row['scheduled_time'],
          a_notification_id: row['notification_id'],
          a_status: row['status'],
          a_is_enabled: row['is_enabled'],
          a_created_at: row['created_at'],
          a_updated_at: row['updated_at'],
          m_id: meet['id'],
          m_google_event_id: meet['google_event_id'],
          m_calendar_id: meet['calendar_id'],
          m_title: meet['title'],
          m_description: meet['description'],
          m_start_time: meet['start_time'],
          m_end_time: meet['end_time'],
          m_timezone: meet['timezone'],
          m_location: meet['location'],
          m_meeting_url: meet['meeting_url'],
          m_platform: meet['platform'],
          m_organizer_name: meet['organizer_name'],
          m_organizer_email: meet['organizer_email'],
          m_attendees: meet['attendees'],
          m_source: meet['source'],
          m_status: meet['status'],
          m_is_all_day: meet['is_all_day'],
          m_created_at: meet['created_at'],
          m_updated_at: meet['updated_at'],
        };
      }

      if (!whereClause || this.evaluateWhere(combinedRow, whereClause, params, 0)) {
        filtered.push(combinedRow);
      }
    }

    // ORDER BY
    const orderMatch = tail.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/is);
    if (orderMatch) {
      const orderClauses = orderMatch[1].split(',').map((o) => o.trim());
      filtered.sort((a, b) => {
        for (const order of orderClauses) {
          const parts = order.split(/\s+/);
          const rawCol = parts[0].replace(/^[a-zA-Z0-9_]+\./, '').toLowerCase();
          const isDesc = parts[1] && parts[1].toUpperCase() === 'DESC';

          const valA = a[rawCol];
          const valB = b[rawCol];

          if (valA !== valB) {
            if (valA === undefined || valA === null) return isDesc ? 1 : -1;
            if (valB === undefined || valB === null) return isDesc ? -1 : 1;
            if (valA < valB) return isDesc ? 1 : -1;
            if (valA > valB) return isDesc ? -1 : 1;
          }
        }
        return 0;
      });
    }

    // LIMIT
    const limitMatch = tail.match(/LIMIT\s+(\d+|\?)/is);
    if (limitMatch) {
      let limitNum = parseInt(limitMatch[1], 10);
      if (isNaN(limitNum) && limitMatch[1] === '?') {
        const lastParam = params[params.length - 1];
        if (typeof lastParam === 'number') {
          limitNum = lastParam;
        }
      }
      if (!isNaN(limitNum) && limitNum > 0) {
        filtered = filtered.slice(0, limitNum);
      }
    }

    return filtered as unknown as T[];
  }

  private evaluateWhere(
    row: Row,
    whereClause: string,
    params: (string | number | boolean | null)[],
    initialParamIdx: number = 0
  ): boolean {
    let pIdx = initialParamIdx;

    // Direct single condition: id = ?
    if (/^(?:[a-zA-Z0-9_]+\.)?id\s*=\s*\?$/i.test(whereClause.trim())) {
      const targetId = params[pIdx++];
      return String(row['id']) === String(targetId);
    }

    // Direct condition: google_calendar_id = ?
    if (/^google_calendar_id\s*=\s*\?$/i.test(whereClause.trim())) {
      const targetId = params[pIdx++];
      return String(row['google_calendar_id']) === String(targetId);
    }

    // Direct condition: google_event_id = ?
    if (/^google_event_id\s*=\s*\?$/i.test(whereClause.trim())) {
      const targetId = params[pIdx++];
      return String(row['google_event_id']) === String(targetId);
    }

    // Direct condition: key = ?
    if (/^key\s*=\s*\?$/i.test(whereClause.trim())) {
      const targetKey = params[pIdx++];
      return String(row['key']) === String(targetKey);
    }

    // Direct condition: calendar_id = ?
    if (/^calendar_id\s*=\s*\?$/i.test(whereClause.trim())) {
      const targetId = params[pIdx++];
      return String(row['calendar_id']) === String(targetId);
    }

    // Direct condition: meeting_id = ?
    if (/^meeting_id\s*=\s*\?$/i.test(whereClause.trim())) {
      const targetId = params[pIdx++];
      return String(row['meeting_id']) === String(targetId);
    }

    // Direct condition: is_enabled = 1 OR primary_cal = 1
    if (/^is_enabled\s*=\s*1\s+OR\s+primary_cal\s*=\s*1$/i.test(whereClause.trim())) {
      return row['is_enabled'] === 1 || row['primary_cal'] === 1;
    }

    // Check for meeting date range query
    // ((m.start_time <= ? AND m.end_time >= ?) OR ...)
    if (/start_time\s*<=\s*\?\s+AND\s+[a-zA-Z0-9_.]*end_time\s*>=\s*\?/i.test(whereClause)) {
      const endBoundary = params[0] as string;
      const startBoundary = params[1] as string;
      const mStart = row['start_time'] as string;
      const mEnd = row['end_time'] as string;

      if (!mStart || !mEnd) return false;

      const inRange =
        (mStart <= endBoundary && mEnd >= startBoundary) ||
        (mStart >= startBoundary && mStart <= endBoundary) ||
        (mEnd >= startBoundary && mEnd <= endBoundary);

      if (!inRange) return false;

      // Check sources filter if present
      if (/m\.source\s+IN/i.test(whereClause)) {
        const sourceMatches = whereClause.match(/m\.source\s+IN\s*\(([^)]+)\)/i);
        if (sourceMatches) {
          const numParams = sourceMatches[1].split(',').length;
          const sourceParams = params.slice(6, 6 + numParams);
          if (!sourceParams.includes(row['source'])) {
            return false;
          }
        }
      }

      // Check search query if present
      if (/m\.title\s+LIKE/i.test(whereClause)) {
        const searchParam = params[params.length - 1] as string;
        if (searchParam) {
          const q = searchParam.replace(/%/g, '').toLowerCase();
          const title = String(row['title'] || '').toLowerCase();
          const desc = String(row['description'] || '').toLowerCase();
          const loc = String(row['location'] || '').toLowerCase();
          if (!title.includes(q) && !desc.includes(q) && !loc.includes(q)) {
            return false;
          }
        }
      }

      return true;
    }

    // Check for upcoming meetings query: m.end_time >= ? AND m.status != 'cancelled'
    if (/end_time\s*>=\s*\?\s+AND\s+[a-zA-Z0-9_.]*status\s*!=\s*'cancelled'/i.test(whereClause)) {
      const nowIso = params[0] as string;
      const mEnd = row['end_time'] as string;
      const mStatus = row['status'] as string;
      return mEnd >= nowIso && mStatus !== 'cancelled';
    }

    // Check for upcoming alarms query: a.is_enabled = 1 AND a.status = 'pending' AND a.scheduled_time >= ?
    if (/a\.is_enabled\s*=\s*1\s+AND\s+a\.status\s*=\s*'pending'\s+AND\s+a\.scheduled_time\s*>=\s*\?/i.test(whereClause)) {
      const nowIso = params[0] as string;
      return (
        row['a_is_enabled'] === 1 &&
        row['a_status'] === 'pending' &&
        row['a_scheduled_time'] >= nowIso
      );
    }

    // Check for search query: m.title LIKE ? OR m.description LIKE ?
    if (/title\s+LIKE\s+\?\s+OR\s+[a-zA-Z0-9_.]*description\s+LIKE/i.test(whereClause)) {
      const q = String(params[0] || '').replace(/%/g, '').toLowerCase();
      const title = String(row['title'] || '').toLowerCase();
      const desc = String(row['description'] || '').toLowerCase();
      const loc = String(row['location'] || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || loc.includes(q);
    }

    return true;
  }
}
