import crypto from 'node:crypto';
import { db } from '../db/database.js';

export interface CsvPreviewRecord {
  type: 'fuel' | 'service';
  date: string;
  odometer: number;
  liters?: number;
  pricePerLiter?: number;
  totalCost: number;
  serviceItem?: string;
  notes?: string;
  isValid: boolean;
  error?: string;
}

export interface CsvPreviewResult {
  detectedFormat: 'fuelio' | 'lubelogger' | 'generic';
  headers: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  records: CsvPreviewRecord[];
}

export interface GenericColumnMapping {
  type: 'fuel' | 'service';
  dateColumn: string;
  odometerColumn: string;
  costColumn: string;
  litersColumn?: string;
  priceColumn?: string;
  serviceItemColumn?: string;
  notesColumn?: string;
}

export class ImportService {
  /**
   * Simple and robust CSV line splitter respecting quoted fields with commas.
   */
  public static parseCsvLines(csvContent: string): string[][] {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows: string[][] = [];

    for (const line of lines) {
      const row: string[] = [];
      let inQuotes = false;
      let curVal = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
          row.push(curVal.trim().replace(/^["']|["']$/g, ''));
          curVal = '';
        } else {
          curVal += char;
        }
      }
      row.push(curVal.trim().replace(/^["']|["']$/g, ''));
      rows.push(row);
    }

    return rows;
  }

  /**
   * Analyzes CSV headers and content to auto-detect format.
   */
  public static previewImport(
    csvContent: string,
    vehicleId: string,
    forcedFormat?: 'fuelio' | 'lubelogger' | 'generic',
    customMapping?: GenericColumnMapping
  ): CsvPreviewResult {
    const rawRows = this.parseCsvLines(csvContent);
    if (rawRows.length < 2) {
      return {
        detectedFormat: 'generic',
        headers: [],
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        records: [],
      };
    }

    // Skip any metadata/comment lines (e.g. "## Data") to find true header row
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const lowerRow = rawRows[i].map((c) => c.toLowerCase().trim());
      if (
        lowerRow.includes('odometer') ||
        lowerRow.includes('date') ||
        lowerRow.includes('datum') ||
        lowerRow.includes('km') ||
        lowerRow.includes('cost') ||
        lowerRow.includes('fuel_amount')
      ) {
        headerRowIdx = i;
        break;
      }
    }

    const rows = rawRows.slice(headerRowIdx);
    const headers = rows[0].map((h) => h.toLowerCase().trim());
    let detectedFormat: 'fuelio' | 'lubelogger' | 'generic' = forcedFormat || 'generic';

    if (!forcedFormat) {
      if (headers.includes('odometer') && (headers.includes('fuel_amount') || headers.includes('litres') || headers.includes('liters'))) {
        detectedFormat = 'fuelio';
      } else if (headers.includes('date') && headers.includes('type') && (headers.includes('cost') || headers.includes('odometer'))) {
        detectedFormat = 'lubelogger';
      }
    }

    const parsedRecords: CsvPreviewRecord[] = [];

    // Fetch existing min/max odometers to flag anomalies
    const vehicle = db.get<{ initial_odometer: number }>('SELECT initial_odometer FROM vehicles WHERE id = ?', [vehicleId]);
    const initialOdo = vehicle?.initial_odometer || 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      const record = this.parseRow(headers, row, detectedFormat, customMapping, initialOdo);
      if (record) {
        parsedRecords.push(record);
      }
    }

    const validRows = parsedRecords.filter((r) => r.isValid).length;
    const errorRows = parsedRecords.length - validRows;

    return {
      detectedFormat,
      headers: rows[0],
      totalRows: parsedRecords.length,
      validRows,
      errorRows,
      records: parsedRecords,
    };
  }

  private static parseRow(
    headers: string[],
    row: string[],
    format: 'fuelio' | 'lubelogger' | 'generic',
    mapping?: GenericColumnMapping,
    initialOdo = 0
  ): CsvPreviewRecord | null {
    const getVal = (col: string): string => {
      const idx = headers.indexOf(col.toLowerCase());
      return idx !== -1 && idx < row.length ? row[idx] : '';
    };

    let date = '';
    let odo = 0;
    let liters = 0;
    let price = 0;
    let cost = 0;
    let serviceItem = '';
    let notes = '';
    let type: 'fuel' | 'service' = 'fuel';

    if (format === 'fuelio') {
      date = getVal('date') || getVal('datum') || new Date().toISOString().split('T')[0];
      odo = parseFloat(getVal('odometer').replace(',', '.')) || 0;
      liters = parseFloat((getVal('fuel_amount') || getVal('litres') || getVal('liters')).replace(',', '.')) || 0;
      price = parseFloat((getVal('price') || getVal('unit_price')).replace(',', '.')) || 0;
      cost = parseFloat(getVal('total_cost').replace(',', '.')) || (liters && price ? liters * price : 0);
      notes = getVal('notes') || getVal('description') || '';
      type = 'fuel';
    } else if (format === 'lubelogger') {
      date = getVal('date') || new Date().toISOString().split('T')[0];
      odo = parseFloat(getVal('odometer').replace(',', '.')) || 0;
      cost = parseFloat(getVal('cost').replace(',', '.')) || 0;
      notes = getVal('notes') || '';
      const rowType = (getVal('type') || '').toLowerCase();
      
      if (rowType.includes('gas') || rowType.includes('fuel')) {
        type = 'fuel';
        liters = parseFloat((getVal('fuelconsumed') || getVal('gallons') || getVal('liters')).replace(',', '.')) || 0;
        price = liters > 0 ? cost / liters : 0;
      } else {
        type = 'service';
        serviceItem = getVal('description') || getVal('service_item') || 'Service Log';
      }
    } else if (mapping) {
      type = mapping.type;
      date = getVal(mapping.dateColumn) || new Date().toISOString().split('T')[0];
      odo = parseFloat(getVal(mapping.odometerColumn).replace(',', '.')) || 0;
      cost = parseFloat(getVal(mapping.costColumn).replace(',', '.')) || 0;
      if (type === 'fuel') {
        liters = mapping.litersColumn ? parseFloat(getVal(mapping.litersColumn).replace(',', '.')) || 0 : 0;
        price = mapping.priceColumn ? parseFloat(getVal(mapping.priceColumn).replace(',', '.')) || 0 : (liters > 0 ? cost / liters : 0);
      } else {
        serviceItem = mapping.serviceItemColumn ? getVal(mapping.serviceItemColumn) : 'Service';
      }
      notes = mapping.notesColumn ? getVal(mapping.notesColumn) : '';
    } else {
      // Generic fallback heuristic
      date = row[0] || new Date().toISOString().split('T')[0];
      odo = parseFloat((row[1] || '0').replace(',', '.')) || 0;
      cost = parseFloat((row[2] || '0').replace(',', '.')) || 0;
      notes = row[3] || '';
    }

    let isValid = true;
    let error: string | undefined;

    if (isNaN(odo) || odo <= 0) {
      isValid = false;
      error = 'Invalid odometer reading';
    } else if (odo < initialOdo) {
      isValid = false;
      error = `Odometer (${odo}) is lower than initial vehicle reading (${initialOdo})`;
    } else if (!date || isNaN(Date.parse(date))) {
      isValid = false;
      error = 'Invalid date format';
    }

    return {
      type,
      date,
      odometer: odo,
      liters: liters || undefined,
      pricePerLiter: price || undefined,
      totalCost: Math.round(cost * 100) / 100,
      serviceItem: serviceItem || undefined,
      notes: notes || undefined,
      isValid,
      error,
    };
  }

  /**
   * Commits validated records into the database.
   */
  public static executeImport(vehicleId: string, records: CsvPreviewRecord[]): { importedCount: number } {
    let importedCount = 0;

    for (const r of records) {
      if (!r.isValid) continue;

      if (r.type === 'fuel') {
        db.run(
          `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, missed_previous, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
          [
            crypto.randomUUID(),
            vehicleId,
            r.date,
            r.odometer,
            r.liters || 0,
            r.pricePerLiter || (r.liters ? r.totalCost / r.liters : 0),
            r.totalCost,
            r.notes || 'Imported via CSV',
            new Date().toISOString(),
          ]
        );
        importedCount++;
      } else {
        db.run(
          `INSERT INTO service_records (id, vehicle_id, service_item, date, odometer, performing_party, cost, notes, created_at)
           VALUES (?, ?, ?, ?, ?, 'garage', ?, ?, ?)`,
          [
            crypto.randomUUID(),
            vehicleId,
            r.serviceItem || 'Imported Maintenance',
            r.date,
            r.odometer,
            r.totalCost,
            r.notes || 'Imported via CSV',
            new Date().toISOString(),
          ]
        );
        importedCount++;
      }
    }

    return { importedCount };
  }
}
