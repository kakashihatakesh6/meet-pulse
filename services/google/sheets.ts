import { GOOGLE_API_ENDPOINTS } from '../../constants/oauth';
import { GoogleOAuthService } from './oauth';
import { GoogleDriveSpreadsheet } from '../../types/import';
import { logger } from '../../utils/logger';

export interface GoogleSpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: Array<{
    sheetId: number;
    title: string;
    rowCount: number;
    columnCount: number;
  }>;
}

export const GoogleSheetsService = {
  /**
   * Lists Google Spreadsheet files accessible to the user from Google Drive
   */
  async listUserSpreadsheets(): Promise<GoogleDriveSpreadsheet[]> {
    const accessToken = await GoogleOAuthService.getValidAccessToken();
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const url = `${GOOGLE_API_ENDPOINTS.driveFiles}?q=${query}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`;

    logger.info('Fetching Google Spreadsheets list from Drive API');
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list spreadsheets (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];

    return files.map((f: { id: string; name: string; mimeType: string; modifiedTime?: string }) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
    }));
  },

  /**
   * Fetches metadata including sheet/tab titles for a spreadsheet
   */
  async getSpreadsheetMetadata(spreadsheetId: string): Promise<GoogleSpreadsheetMetadata> {
    const accessToken = await GoogleOAuthService.getValidAccessToken();
    const url = `${GOOGLE_API_ENDPOINTS.sheetsMetadata(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title,gridProperties)`;

    logger.info(`Fetching metadata for spreadsheet: ${spreadsheetId}`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch sheet metadata (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const sheets = (data.sheets || []).map((s: { properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      rowCount: s.properties.gridProperties?.rowCount || 0,
      columnCount: s.properties.gridProperties?.columnCount || 0,
    }));

    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title || 'Untitled Spreadsheet',
      sheets,
    };
  },

  /**
   * Fetches row values from a spreadsheet range (e.g. "Sheet1!A1:Z500")
   */
  async getSheetValues(
    spreadsheetId: string,
    sheetName: string,
    maxRows: number = 500
  ): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
    const accessToken = await GoogleOAuthService.getValidAccessToken();
    const range = `${sheetName}!A1:Z${maxRows}`;
    const url = GOOGLE_API_ENDPOINTS.sheetsValues(spreadsheetId, range);

    logger.info(`Fetching values from sheet range: ${range}`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch sheet values (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawValues: unknown[][] = Array.isArray(data.values) ? data.values : [];

    if (rawValues.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = rawValues[0].map((h) => String(h || '').trim());
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < rawValues.length; i++) {
      const rowArr = rawValues[i];
      if (!rowArr || rowArr.length === 0) continue;

      const rowObj: Record<string, unknown> = {};
      let hasData = false;

      headers.forEach((header, idx) => {
        if (header) {
          const val = rowArr[idx] !== undefined ? rowArr[idx] : '';
          rowObj[header] = val;
          if (val !== '') hasData = true;
        }
      });

      if (hasData) {
        rows.push(rowObj);
      }
    }

    return { headers, rows };
  },
};
