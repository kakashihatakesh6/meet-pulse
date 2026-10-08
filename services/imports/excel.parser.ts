import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { SpreadsheetParseResult, SpreadsheetRow } from '../../types/import';
import { suggestColumnMapping } from './meeting.mapper';
import { logger } from '../../utils/logger';

export const ExcelParserService = {
  /**
   * Reads a file from device storage (URI) and parses it using SheetJS
   */
  async parseSpreadsheetFile(
    fileUri: string,
    fileName: string,
    sheetName?: string
  ): Promise<SpreadsheetParseResult> {
    logger.info(`Parsing spreadsheet file: ${fileName} from URI: ${fileUri}`);

    try {
      // Read file content as base64
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Parse with SheetJS
      const workbook = XLSX.read(fileBase64, {
        type: 'base64',
        cellDates: false, // keep serial numbers or strings intact for our robust validator
        raw: true,
      });

      const sheetNames = workbook.SheetNames;
      if (sheetNames.length === 0) {
        throw new Error('Spreadsheet contains no sheets/worksheets');
      }

      const activeSheetName = sheetName && sheetNames.includes(sheetName)
        ? sheetName
        : sheetNames[0];

      const worksheet = workbook.Sheets[activeSheetName];
      if (!worksheet) {
        throw new Error(`Worksheet "${activeSheetName}" not found in file`);
      }

      // Convert to JSON array of arrays first to extract header cleanly
      const rawMatrix: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (rawMatrix.length === 0) {
        return {
          fileName,
          sheetNames,
          activeSheet: activeSheetName,
          headers: [],
          rawRows: [],
          suggestedMapping: suggestColumnMapping([]),
        };
      }

      // Find header row (first non-empty row)
      let headerRowIndex = 0;
      for (let i = 0; i < rawMatrix.length; i++) {
        if (rawMatrix[i].some((cell) => cell !== '')) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = (rawMatrix[headerRowIndex] || []).map((h, i) =>
        String(h || '').trim() || `Column_${i + 1}`
      );

      // Convert rows after header to objects
      const rawRows: SpreadsheetRow[] = [];
      for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
        const rowArr = rawMatrix[i];
        if (!rowArr || rowArr.every((c) => c === '')) continue;

        const rowObj: SpreadsheetRow = {};
        headers.forEach((h, idx) => {
          rowObj[h] = rowArr[idx] !== undefined ? rowArr[idx] : '';
        });

        rawRows.push(rowObj);
      }

      const suggestedMapping = suggestColumnMapping(headers);

      logger.info(`Successfully parsed ${rawRows.length} rows with ${headers.length} columns`);

      return {
        fileName,
        sheetNames,
        activeSheet: activeSheetName,
        headers,
        rawRows,
        suggestedMapping,
      };
    } catch (err) {
      logger.error('Failed to parse spreadsheet file', err);
      throw new Error(`Spreadsheet parsing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
