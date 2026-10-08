import { ExcelParserService } from './excel.parser';
import { SpreadsheetParseResult } from '../../types/import';

export const CsvParserService = {
  /**
   * Parses CSV file reusing the robust SheetJS engine
   */
  async parseCsvFile(fileUri: string, fileName: string): Promise<SpreadsheetParseResult> {
    return ExcelParserService.parseSpreadsheetFile(fileUri, fileName);
  },
};
