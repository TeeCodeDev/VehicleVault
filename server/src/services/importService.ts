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
  stationName?: string;
  latitude?: number;
  longitude?: number;
  isFullTank?: boolean;
  missedPrevious?: boolean;
  isValid: boolean;
  error?: string;
}

export interface FuelioVehicleInfo {
  name?: string;
  plate?: string;
  make?: string;
  model?: string;
  year?: number;
  tankCapacity?: number;
}

export interface CsvPreviewResult {
  detectedFormat: 'fuelio' | 'lubelogger' | 'generic';
  headers: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  records: CsvPreviewRecord[];
  vehicleInfo?: FuelioVehicleInfo;
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
  public static parseCsvRow(line: string): string[] {
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
    return row;
  }

  public static parseCsvLines(csvContent: string): string[][] {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return lines.map((line) => this.parseCsvRow(line));
  }

  /**
   * Splits multi-section Fuelio CSVs (## Vehicle, ## Log, ## Category, etc.)
   */
  public static parseFuelioSections(csvContent: string): {
    vehicleSection?: { headers: string[]; rows: string[][] };
    logSection?: { headers: string[]; rows: string[][] };
  } {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const sections: Record<string, string[][]> = {};
    let currentSection = 'default';

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      const match = trimmed.match(/^"?##\s*([A-Za-z0-9_\-\s]+)"?$/);
      if (match) {
        currentSection = match[1].trim();
        sections[currentSection] = [];
        continue;
      }
      const parsedRow = this.parseCsvRow(trimmed);
      if (parsedRow.length > 0) {
        if (!sections[currentSection]) sections[currentSection] = [];
        sections[currentSection].push(parsedRow);
      }
    }

    let vehicleSection: { headers: string[]; rows: string[][] } | undefined;
    const vKey = Object.keys(sections).find((k) => k.toLowerCase() === 'vehicle');
    if (vKey && sections[vKey].length >= 2) {
      vehicleSection = {
        headers: sections[vKey][0].map((h) => h.toLowerCase().trim()),
        rows: sections[vKey].slice(1),
      };
    }

    let logSection: { headers: string[]; rows: string[][] } | undefined;
    const lKey = Object.keys(sections).find((k) => k.toLowerCase() === 'log' || k.toLowerCase() === 'data');
    if (lKey && sections[lKey].length >= 2) {
      logSection = {
        headers: sections[lKey][0].map((h) => h.toLowerCase().trim()),
        rows: sections[lKey].slice(1),
      };
    }

    return { vehicleSection, logSection };
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
    // Check if the CSV has Fuelio multi-section headers (e.g. ## Vehicle or ## Log)
    const isMultiSectionFuelio =
      forcedFormat === 'fuelio' ||
      csvContent.includes('## Log') ||
      csvContent.includes('## Vehicle') ||
      csvContent.includes('"## Log"') ||
      csvContent.includes('"## Vehicle"');

    if (isMultiSectionFuelio && (forcedFormat === 'fuelio' || !forcedFormat)) {
      const { vehicleSection, logSection } = this.parseFuelioSections(csvContent);

      let vehicleInfo: FuelioVehicleInfo | undefined;
      if (vehicleSection && vehicleSection.rows.length > 0) {
        const vHeaders = vehicleSection.headers;
        const vRow = vehicleSection.rows[0];
        const getVVal = (...aliases: string[]): string => {
          for (const alias of aliases) {
            const idx = vHeaders.indexOf(alias.toLowerCase());
            if (idx !== -1 && idx < vRow.length) return vRow[idx].trim();
          }
          return '';
        };

        const yearNum = parseInt(getVVal('year'), 10);
        const tankCap = parseFloat(getVVal('tank1capacity', 'tankcapacity'));
        vehicleInfo = {
          name: getVVal('name'),
          plate: getVVal('plate', 'license_plate', 'kenteken'),
          make: getVVal('make'),
          model: getVVal('model'),
          year: !isNaN(yearNum) ? yearNum : undefined,
          tankCapacity: !isNaN(tankCap) && tankCap > 0 ? tankCap : undefined,
        };
      }

      if (logSection && logSection.rows.length > 0) {
        const headers = logSection.headers;
        const rows = logSection.rows;
        const parsedRecords: CsvPreviewRecord[] = [];

        for (const row of rows) {
          if (row.length < 2) continue;
          const record = this.parseRow(headers, row, 'fuelio', customMapping);
          if (record) parsedRecords.push(record);
        }

        const validRows = parsedRecords.filter((r) => r.isValid).length;
        const errorRows = parsedRecords.length - validRows;

        return {
          detectedFormat: 'fuelio',
          headers: logSection.headers,
          totalRows: parsedRecords.length,
          validRows,
          errorRows,
          records: parsedRecords,
          vehicleInfo,
        };
      }
    }

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

    // Skip metadata/comment lines to find true header row
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 6); i++) {
      const lowerRow = rawRows[i].map((c) => c.toLowerCase().trim());
      if (
        lowerRow.includes('odometer') ||
        lowerRow.includes('odo') ||
        lowerRow.some((c) => c.startsWith('odo')) ||
        lowerRow.includes('date') ||
        lowerRow.includes('data') ||
        lowerRow.includes('datum') ||
        lowerRow.includes('km') ||
        lowerRow.includes('cost') ||
        lowerRow.includes('fuel_amount') ||
        lowerRow.some((c) => c.startsWith('fuel'))
      ) {
        headerRowIdx = i;
        break;
      }
    }

    const rows = rawRows.slice(headerRowIdx);
    const headers = rows[0].map((h) => h.toLowerCase().trim());
    let detectedFormat: 'fuelio' | 'lubelogger' | 'generic' = forcedFormat || 'generic';

    if (!forcedFormat) {
      const hasOdo = headers.some((h) => h.includes('odo') || h.includes('odometer') || h.includes('km'));
      const hasFuel = headers.some((h) => h.includes('fuel') || h.includes('litres') || h.includes('liters') || h.includes('volumeprice'));
      const hasLubeType = headers.includes('type') && (headers.includes('cost') || headers.includes('service'));

      if (hasOdo && hasFuel) {
        detectedFormat = 'fuelio';
      } else if (headers.includes('date') && hasLubeType) {
        detectedFormat = 'lubelogger';
      }
    }

    const parsedRecords: CsvPreviewRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      // Skip lines that denote new sections in multi-section formats
      if (row[0].startsWith('##')) continue;

      const record = this.parseRow(headers, row, detectedFormat, customMapping);
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
    mapping?: GenericColumnMapping
  ): CsvPreviewRecord | null {
    const getValByAliases = (...aliases: string[]): string => {
      for (const alias of aliases) {
        const lowerAlias = alias.toLowerCase().trim();
        const idx = headers.findIndex((h) => {
          const cleanH = h.toLowerCase().replace(/[\(\)\[\]]/g, '').trim();
          return cleanH === lowerAlias || cleanH.startsWith(lowerAlias);
        });
        if (idx !== -1 && idx < row.length) {
          return row[idx].trim();
        }
      }
      return '';
    };

    let date = '';
    let odo = 0;
    let liters = 0;
    let pricePerLiter = 0;
    let cost = 0;
    let serviceItem = '';
    let notes = '';
    let stationName = '';
    let latitude: number | undefined;
    let longitude: number | undefined;
    let isFullTank = true;
    let missedPrevious = false;
    let type: 'fuel' | 'service' = 'fuel';

    if (format === 'fuelio') {
      const rawDate = getValByAliases('data', 'date', 'datum', 'datetime') || new Date().toISOString().split('T')[0];
      // Clean date (e.g., "2026-10-14 08:05" -> "2026-10-14")
      date = rawDate.split(' ')[0] || rawDate;

      const rawOdo = getValByAliases('odo km', 'odo mi', 'odo', 'odometer', 'km');
      odo = parseFloat(rawOdo.replace(',', '.')) || 0;

      const rawFuel = getValByAliases('fuel litres', 'fuel liters', 'fuel gallons', 'fuel amount', 'fuel', 'litres', 'liters', 'gallons');
      liters = parseFloat(rawFuel.replace(',', '.')) || 0;

      const rawCost = getValByAliases('total_cost', 'total cost', 'total', 'cost', 'price optional', 'price', 'prijs', 'bedrag');
      cost = parseFloat(rawCost.replace(',', '.')) || 0;

      const rawVolumePrice = getValByAliases('volumeprice', 'volume price', 'unit_price', 'price_per_liter', 'prijs_per_liter');
      pricePerLiter = parseFloat(rawVolumePrice.replace(',', '.')) || 0;

      if (!pricePerLiter && liters > 0 && cost > 0) {
        pricePerLiter = Math.round((cost / liters) * 1000) / 1000;
      }
      if (!cost && liters > 0 && pricePerLiter > 0) {
        cost = Math.round(liters * pricePerLiter * 100) / 100;
      }

      const rawFull = getValByAliases('full', 'is_full', 'is_full_tank');
      if (rawFull === '0' || rawFull.toLowerCase() === 'false' || rawFull.toLowerCase() === 'no') {
        isFullTank = false;
      }

      const rawMissed = getValByAliases('missed', 'gemist');
      if (rawMissed === '1' || rawMissed.toLowerCase() === 'true' || rawMissed.toLowerCase() === 'yes') {
        missedPrevious = true;
      }

      stationName = getValByAliases('city optional', 'city', 'station_name', 'station', 'location', 'locatie');
      notes = getValByAliases('notes optional', 'notes', 'description', 'notities', 'opmerkingen');

      const rawLat = getValByAliases('latitude optional', 'latitude', 'lat');
      const rawLon = getValByAliases('longitude optional', 'longitude', 'lon', 'lng');
      if (rawLat && !isNaN(parseFloat(rawLat))) latitude = parseFloat(rawLat);
      if (rawLon && !isNaN(parseFloat(rawLon))) longitude = parseFloat(rawLon);

      type = 'fuel';
    } else if (format === 'lubelogger') {
      date = getValByAliases('date', 'datum') || new Date().toISOString().split('T')[0];
      const rawOdo = getValByAliases('odometer', 'km');
      odo = parseFloat(rawOdo.replace(',', '.')) || 0;
      const rawCost = getValByAliases('cost', 'price', 'total');
      cost = parseFloat(rawCost.replace(',', '.')) || 0;
      notes = getValByAliases('notes', 'description');

      const rowType = (getValByAliases('type') || '').toLowerCase();
      if (rowType.includes('gas') || rowType.includes('fuel')) {
        type = 'fuel';
        const rawFuel = getValByAliases('fuelconsumed', 'gallons', 'liters', 'litres');
        liters = parseFloat(rawFuel.replace(',', '.')) || 0;
        pricePerLiter = liters > 0 ? cost / liters : 0;
      } else {
        type = 'service';
        serviceItem = getValByAliases('description', 'service_item', 'item') || 'Service Log';
      }
    } else if (mapping) {
      type = mapping.type;
      date = getValByAliases(mapping.dateColumn) || new Date().toISOString().split('T')[0];
      odo = parseFloat((getValByAliases(mapping.odometerColumn) || '0').replace(',', '.')) || 0;
      cost = parseFloat((getValByAliases(mapping.costColumn) || '0').replace(',', '.')) || 0;
      if (type === 'fuel') {
        liters = mapping.litersColumn ? parseFloat((getValByAliases(mapping.litersColumn) || '0').replace(',', '.')) || 0 : 0;
        pricePerLiter = mapping.priceColumn
          ? parseFloat((getValByAliases(mapping.priceColumn) || '0').replace(',', '.')) || 0
          : liters > 0
          ? cost / liters
          : 0;
      } else {
        serviceItem = mapping.serviceItemColumn ? getValByAliases(mapping.serviceItemColumn) : 'Service';
      }
      notes = mapping.notesColumn ? getValByAliases(mapping.notesColumn) : '';
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
    } else if (!date || isNaN(Date.parse(date))) {
      isValid = false;
      error = 'Invalid date format';
    }

    return {
      type,
      date,
      odometer: odo,
      liters: liters || undefined,
      pricePerLiter: pricePerLiter || undefined,
      totalCost: Math.round(cost * 100) / 100,
      serviceItem: serviceItem || undefined,
      notes: notes || undefined,
      stationName: stationName || undefined,
      latitude,
      longitude,
      isFullTank,
      missedPrevious,
      isValid,
      error,
    };
  }

  /**
   * Commits validated records into the database with duplicate prevention.
   */
  public static executeImport(vehicleId: string, records: CsvPreviewRecord[]): { importedCount: number; skippedCount: number } {
    let importedCount = 0;
    let skippedCount = 0;

    for (const r of records) {
      if (!r.isValid) continue;

      if (r.type === 'fuel') {
        const existing = db.get<{ id: string }>(
          'SELECT id FROM fuel_entries WHERE vehicle_id = ? AND date = ? AND odometer = ?',
          [vehicleId, r.date, r.odometer]
        );
        if (existing) {
          skippedCount++;
          continue;
        }

        const isFull = r.isFullTank !== false ? 1 : 0;
        const missed = r.missedPrevious ? 1 : 0;
        const pPerLiter = r.pricePerLiter || (r.liters && r.totalCost ? r.totalCost / r.liters : 0);

        db.run(
          `INSERT INTO fuel_entries (
            id, vehicle_id, date, odometer, liters, price_per_liter, total_cost,
            is_full_tank, missed_previous, notes, station_name, latitude, longitude, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            vehicleId,
            r.date,
            r.odometer,
            r.liters || 0,
            pPerLiter,
            r.totalCost,
            isFull,
            missed,
            r.notes || null,
            r.stationName || null,
            r.latitude || null,
            r.longitude || null,
            new Date().toISOString(),
          ]
        );
        importedCount++;
      } else {
        const existing = db.get<{ id: string }>(
          'SELECT id FROM service_records WHERE vehicle_id = ? AND date = ? AND odometer = ? AND service_item = ?',
          [vehicleId, r.date, r.odometer, r.serviceItem || '']
        );
        if (existing) {
          skippedCount++;
          continue;
        }

        db.run(
          `INSERT INTO service_records (
            id, vehicle_id, service_item, date, odometer, performing_party, cost, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, 'garage', ?, ?, ?)`,
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

    return { importedCount, skippedCount };
  }
}
