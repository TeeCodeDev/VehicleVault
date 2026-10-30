import ExcelJS from 'exceljs';
import { db } from '../db/database.js';
import { TripService, TripPurpose } from './tripService.js';

export type TripField =
  | 'date'
  | 'from'
  | 'to'
  | 'start'
  | 'end'
  | 'distance'
  | 'purpose'
  | 'description'
  | 'return'
  | 'plate'
  | 'route';

export const TRIP_FIELD_LABELS: Record<TripField, string> = {
  date: 'Datum',
  from: 'Vertrekadres',
  to: 'Aankomstadres',
  start: 'Beginstand (km)',
  end: 'Eindstand (km)',
  distance: 'Afstand (km)',
  purpose: 'Karakter rit',
  description: 'Toelichting',
  return: 'Terugrit',
  plate: 'Kenteken',
  route: 'Afwijkende route',
};

export type TripColumnMapping = Partial<Record<TripField, string>>;

export interface TripImportRecord {
  rowNumber: number;
  date: string;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  fromLocation: string;
  toLocation: string;
  purpose: TripPurpose;
  description: string;
  isReturnTrip: boolean;
  isValid: boolean;
  isDuplicate: boolean;
  /** Which vehicle block of the file the row belongs to (0 until the first vehicle-change row). */
  section: number;
  error?: string;
  warning?: string;
}

export interface TripImportSection {
  index: number;
  label: string;
  plate: string | null;
  /** Compared with the selected vehicle's plate; null when either side has none. */
  plateMatches: boolean | null;
  rows: number;
}

export interface TripImportIgnoredRow {
  rowNumber: number;
  reason: string;
  text: string;
}

export interface TripImportPreview {
  format: 'csv' | 'xlsx';
  headers: string[];
  mapping: TripColumnMapping;
  missingRequired: TripField[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  sections: TripImportSection[];
  ignoredRows: TripImportIgnoredRow[];
  records: TripImportRecord[];
}

export class TripImportError extends Error {}

function cellText(c: unknown): string {
  if (c instanceof Date) return isNaN(c.getTime()) ? '' : c.toISOString().slice(0, 10);
  return String(c ?? '').trim();
}

function purposeLabel(purpose: TripPurpose): string {
  return purpose === 'business' ? 'zakelijk' : purpose === 'commute' ? 'woon-werk' : 'privé';
}

/** Spelling variants of each column, compared after normalise(): lower case, no accents, letters and digits only. */
const ALIASES: Record<TripField, string[]> = {
  date: ['datum', 'dag', 'ritdatum', 'datumrit', 'datumvanderit'],
  from: ['beginadresrit', 'beginadres', 'vertrekadres', 'vertrek', 'van', 'vanadres', 'vertrekplaats', 'vertrekpunt', 'startadres', 'startlocatie', 'vertreklocatie'],
  to: ['eindadresrit', 'aankomstadres', 'aankomst', 'bestemming', 'naar', 'naaradres', 'bestemmingsadres', 'aankomstplaats', 'eindadres', 'aankomstlocatie', 'bestemminglocatie'],
  start: ['beginstand', 'beginstandkm', 'beginkm', 'kmstandbegin', 'beginkmstand', 'beginkilometerstand', 'kilometerstandbegin', 'tellerstandbegin', 'beginstandteller', 'beginstandkmteller', 'beginstandkilometerteller', 'startkm', 'startstand'],
  end: ['eindstand', 'eindstandkm', 'eindkm', 'kmstandeind', 'eindkmstand', 'eindkilometerstand', 'kilometerstandeind', 'tellerstandeind', 'eindstandteller', 'eindstandkmteller', 'eindstandkilometerteller'],
  distance: ['afstand', 'afstandkm', 'totaalkm', 'gereden', 'geredenkm', 'aantalkm', 'aantalkilometers', 'kilometers', 'km', 'ritafstand', 'afstandvanderit', 'totaleafstand'],
  purpose: ['karaktervanderit', 'karakterrit', 'karakter', 'soortrit', 'ritsoort', 'zakelijkprive', 'priveofzakelijk', 'soort', 'type', 'ritkarakter', 'zakelijkpriveforensen'],
  description: ['bijzonderheden', 'bijzonderhedden', 'toelichtingomschrijving', 'toelichting', 'omschrijving', 'opmerking', 'opmerkingen', 'doel', 'doelvanderit', 'reden', 'bezochteklant', 'bezochtrelatie'],
  return: ['terugrit', 'retourrit', 'retour', 'heenenterug'],
  plate: ['kenteken', 'kentekenvoertuig', 'kentekennummer'],
  route: ['afwijkenderoute', 'route', 'routeafwijking'],
};

export function normalize(value: unknown): string {
  return String(value ?? '')
    .replace(/\(\s*\d+\s*\)/g, '') // footnote markers in the Belastingdienst headers: "Beginadres rit (2)"
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

type Cell = string | number | Date | null;

export class TripImportService {
  // ── Reading the file ────────────────────────────────────────────────────────

  /** Detect the file type from its first bytes: the extension and MIME type are only a hint. */
  public static detectFormat(buffer: Buffer): 'csv' | 'xlsx' {
    if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return 'xlsx'; // "PK": a zip, so .xlsx
    if (buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      throw new TripImportError('Een oud .xls-bestand wordt niet ondersteund. Open het in Excel en sla het op als .xlsx of .csv.');
    }
    return 'csv';
  }

  /** RFC 4180 style parser: quoted fields, doubled quotes, embedded newlines, ; , or tab as delimiter. */
  public static parseCsv(text: string): string[][] {
    const content = text.replace(/^﻿/, '');
    const sample = content.split(/\r?\n/).slice(0, 30).join('\n');
    const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
    let inQuotes = false;
    for (const ch of sample) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch in counts) counts[ch]++;
    }
    const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];

    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    inQuotes = false;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (inQuotes) {
        if (ch === '"' && content[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field.trim());
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && content[i + 1] === '\n') i++;
        row.push(field.trim());
        field = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    if (row.some((c) => c !== '')) rows.push(row);
    return rows;
  }

  public static async readXlsx(buffer: Buffer): Promise<Cell[][]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new TripImportError('Het Excel-bestand kon niet worden gelezen.');
    }
    // The first sheet that has data; the VehicleVault export and the Belastingdienst model keep it on sheet one.
    const sheet = workbook.worksheets.find((s) => s.actualRowCount > 0);
    if (!sheet) return [];
    const rows: Cell[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: Cell[] = [];
      for (let c = 1; c <= row.cellCount; c++) {
        let v: any = row.getCell(c).value;
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          if ('result' in v) v = v.result; // formula
          else if ('richText' in v) v = v.richText.map((r: any) => r.text).join('');
          else if ('text' in v) v = v.text; // hyperlink
          else v = null;
        }
        cells.push(v === undefined ? null : (v as Cell));
      }
      rows.push(cells);
    });
    return rows;
  }

  // ── Finding the table ───────────────────────────────────────────────────────

  /** Title blocks and summary rows sit above the table: the header is the first row that looks like one. */
  public static findHeaderRow(rows: Cell[][]): number {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const mapping = this.autoMap(rows[i].map((c) => String(c ?? '')));
      const score = Object.keys(mapping).length;
      if (mapping.date && score >= 3 && score > bestScore) {
        best = i;
        bestScore = score;
        if (score >= 5) break;
      }
    }
    return best;
  }

  public static autoMap(headers: string[]): TripColumnMapping {
    const mapping: TripColumnMapping = {};
    const normalized = headers.map(normalize);
    const taken = new Set<number>();

    // Exact spelling variants first, in field order
    for (const field of Object.keys(ALIASES) as TripField[]) {
      const idx = normalized.findIndex((h, i) => !taken.has(i) && h !== '' && ALIASES[field].includes(h));
      if (idx >= 0) {
        mapping[field] = headers[idx];
        taken.add(idx);
      }
    }

    // Looser wording: "Km-stand begin", "Begin km-teller", "Eindstand teller (km)" ...
    const loose = (field: TripField, test: (h: string) => boolean) => {
      if (mapping[field]) return;
      const idx = normalized.findIndex((h, i) => !taken.has(i) && h !== '' && test(h));
      if (idx >= 0) {
        mapping[field] = headers[idx];
        taken.add(idx);
      }
    };
    loose('start', (h) => (h.includes('begin') || h.includes('start')) && (h.includes('stand') || h.includes('km') || h.includes('teller')));
    loose('end', (h) => h.includes('eind') && (h.includes('stand') || h.includes('km') || h.includes('teller')));
    loose('from', (h) => h.includes('vertrek') || h.startsWith('van'));
    loose('to', (h) => h.includes('aankomst') || h.includes('bestemming'));
    loose('date', (h) => h.includes('datum'));
    loose('distance', (h) => h.includes('afstand') || h.includes('totaalkm'));
    loose('purpose', (h) => h.includes('karakter') || h.includes('zakelijk') || h.includes('prive'));
    loose('description', (h) => h.includes('toelichting') || h.includes('omschrijving'));
    return mapping;
  }

  // ── Normalising values ──────────────────────────────────────────────────────

  public static parseDate(value: Cell): string | null {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number') {
      // Excel serial date (days since 1899-12-30)
      if (value > 20000 && value < 80000) {
        return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
      }
      return null;
    }
    const text = String(value ?? '').trim();
    if (!text) return null;

    let y: number, m: number, d: number;
    let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) {
      [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    } else if ((match = text.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})(?!\d)/))) {
      [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
      if (y < 100) y += 2000;
    } else {
      return null;
    }
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
    return date.toISOString().slice(0, 10);
  }

  /** Dutch and plain numbers: 12345, 12.345, 12.345,6, 12 345,6, "12345 km". */
  public static parseNumber(value: Cell): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let text = String(value ?? '')
      .replace(/ /g, ' ')
      .replace(/km/gi, '')
      .replace(/\s/g, '')
      .trim();
    if (!text) return null;
    if (text.includes(',')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, '');
    }
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  public static parsePurpose(value: Cell, fallback: TripPurpose): TripPurpose {
    const text = normalize(value);
    if (!text) return fallback;
    if (text.includes('woonwerk') || text.includes('commute') || text.includes('forens')) return 'commute';
    if (text.includes('prive') || text.includes('particulier') || text.includes('private') || text === 'p') return 'private';
    if (text.includes('zakelijk') || text.includes('business') || text === 'z') return 'business';
    return fallback;
  }

  public static parseBoolean(value: Cell): boolean {
    return ['ja', 'yes', 'true', '1', 'x', 'j', 'retour'].includes(normalize(value));
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  public static async preview(
    buffer: Buffer,
    vehicleId: string,
    options: { mapping?: TripColumnMapping; defaultPurpose?: TripPurpose; vehiclePlate?: string | null } = {}
  ): Promise<TripImportPreview> {
    const format = this.detectFormat(buffer);
    const rows: Cell[][] = format === 'xlsx' ? await this.readXlsx(buffer) : this.parseCsv(buffer.toString('utf-8'));
    const defaultPurpose = options.defaultPurpose ?? 'private';

    const headerIdx = options.mapping ? this.firstNonEmptyRow(rows) : this.findHeaderRow(rows);
    if (headerIdx < 0) {
      // No recognisable table: still hand back the first row's headers so the user can map the columns by hand.
      const fallback = this.firstNonEmptyRow(rows);
      const headers = fallback >= 0 ? rows[fallback].map((c) => String(c ?? '')) : [];
      return this.emptyPreview(format, headers, rows.length ? rows.length - 1 : 0);
    }

    const headers = rows[headerIdx].map((c) => String(c ?? '').trim());
    const mapping = options.mapping && Object.keys(options.mapping).length ? options.mapping : this.autoMap(headers);
    const colIndex = (field: TripField): number => {
      const header = mapping[field];
      return header ? headers.indexOf(header) : -1;
    };
    const idx = Object.fromEntries((Object.keys(ALIASES) as TripField[]).map((f) => [f, colIndex(f)])) as Record<TripField, number>;

    const missingRequired: TripField[] = [];
    if (idx.date < 0) missingRequired.push('date');
    if (idx.from < 0) missingRequired.push('from');
    if (idx.to < 0) missingRequired.push('to');
    const odometerPairs = [idx.start >= 0, idx.end >= 0, idx.distance >= 0].filter(Boolean).length;
    if (odometerPairs < 2) {
      if (idx.start < 0) missingRequired.push('start');
      if (idx.end < 0) missingRequired.push('end');
    }

    const records: TripImportRecord[] = [];
    const ignoredRows: TripImportIgnoredRow[] = [];
    const sectionMarkers: { label: string }[] = [];
    const seen = new Set<string>();
    let section = 0;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      const get = (f: TripField): Cell => (idx[f] >= 0 ? row[idx[f]] ?? null : null);
      const cells = row.map(cellText).filter((c) => c !== '');
      if (cells.length === 0) continue;

      const date = this.parseDate(get('date'));
      const hasOdometers = this.parseNumber(get('start')) !== null && this.parseNumber(get('end')) !== null;
      if (!date && !hasOdometers) {
        // A row of one text repeated over merged cells is a vehicle change ("BMW i4 -> WISSELEN LEASEAUTO"):
        // everything below it belongs to another car. Other rows without a date are notes or totals.
        if (cells.length >= 2 && cells.every((c) => c === cells[0])) {
          sectionMarkers.push({ label: cells[0].split(/\s*(?:->|→|=>)\s*/).pop()!.trim() || cells[0] });
          section = sectionMarkers.length;
        } else if (cells.length >= 1) {
          ignoredRows.push({ rowNumber: r + 1, reason: 'Geen datum: notitie of totaalregel', text: cells.join(' | ').slice(0, 120) });
        }
        continue;
      }

      const record = this.buildRecord(r + 1, get, vehicleId, defaultPurpose, seen, missingRequired.length > 0, section, records[records.length - 1]);
      if (record.isValid && record.distanceKm === 0) {
        ignoredRows.push({ rowNumber: r + 1, reason: '0 km: geen rit', text: cells.join(' | ').slice(0, 120) });
        continue;
      }
      records.push(record);
    }

    const vehicleInfo = this.extractVehicleInfo(rows, headerIdx);
    const wanted = this.normalizePlate(options.vehiclePlate);
    const toSection = (index: number, label: string, plate: string | null): TripImportSection => ({
      index,
      label,
      plate,
      plateMatches: plate && wanted ? this.normalizePlate(plate) === wanted : null,
      rows: records.filter((x) => x.section === index && x.isValid).length,
    });
    const sections: TripImportSection[] = [
      toSection(
        0,
        [vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(' ') + (vehicleInfo.plate ? ` (${vehicleInfo.plate})` : '') || 'Bestand',
        vehicleInfo.plate ?? null
      ),
      ...sectionMarkers.map((m, i) => toSection(i + 1, m.label, this.findPlate(m.label))),
    ];

    return {
      format,
      headers,
      mapping,
      missingRequired,
      totalRows: records.length,
      validRows: records.filter((r) => r.isValid).length,
      errorRows: records.filter((r) => !r.isValid).length,
      duplicateRows: records.filter((r) => r.isValid && r.isDuplicate).length,
      sections: sections.filter((x) => x.index === 0 ? x.rows > 0 || sectionMarkers.length === 0 : true),
      ignoredRows: ignoredRows.slice(0, 50),
      records,
    };
  }

  private static firstNonEmptyRow(rows: Cell[][]): number {
    return rows.findIndex((r) => r.some((c) => String(c ?? '').trim() !== ''));
  }

  private static emptyPreview(format: 'csv' | 'xlsx', headers: string[], totalRows: number): TripImportPreview {
    return {
      format,
      headers,
      mapping: {},
      missingRequired: ['date', 'from', 'to', 'start', 'end'],
      totalRows,
      validRows: 0,
      errorRows: 0,
      duplicateRows: 0,
      sections: [],
      ignoredRows: [],
      records: [],
    };
  }

  public static normalizePlate(plate: string | null | undefined): string {
    return String(plate ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /** A Dutch plate in a line of text, e.g. "Mercedes EQE 300 (JDT-12-K)". */
  public static findPlate(text: string): string | null {
    const m = String(text ?? '').toUpperCase().match(/\b[A-Z0-9]{1,3}-[A-Z0-9]{2,3}-[A-Z0-9]{1,3}\b/);
    return m ? m[0] : null;
  }

  /** Make, model and plate from the block above the table ("Merk Auto | Type Auto | Kenteken" with values below). */
  public static extractVehicleInfo(rows: Cell[][], headerIdx: number): { make?: string; model?: string; plate?: string } {
    const info: { make?: string; model?: string; plate?: string } = {};
    for (let i = 0; i < Math.min(headerIdx, rows.length - 1); i++) {
      rows[i].forEach((cell, col) => {
        const key = normalize(cell);
        const below = String(rows[i + 1]?.[col] ?? '').trim();
        if (!below) return;
        if (key === 'kenteken') info.plate = below;
        else if (key === 'merkauto' || key === 'merk') info.make = below;
        else if (key === 'typeauto' || key === 'type') info.model = below;
      });
    }
    return info;
  }

  private static buildRecord(
    rowNumber: number,
    get: (f: TripField) => Cell,
    vehicleId: string,
    defaultPurpose: TripPurpose,
    seen: Set<string>,
    mappingIncomplete: boolean,
    section: number,
    previous?: TripImportRecord
  ): TripImportRecord {
    const date = this.parseDate(get('date'));
    let start = this.parseNumber(get('start'));
    let end = this.parseNumber(get('end'));
    let distance = this.parseNumber(get('distance'));
    const from = String(get('from') ?? '').trim();
    const to = String(get('to') ?? '').trim();

    let error: string | undefined;
    if (mappingIncomplete) error = 'Koppel eerst de ontbrekende kolommen';
    else if (!date) error = 'Ongeldige of ontbrekende datum';
    else {
      if (start === null && end !== null && distance !== null) start = end - distance;
      if (end === null && start !== null && distance !== null) end = start + distance;
      if (start === null || end === null) error = 'Begin- en eindstand (of een stand plus afstand) ontbreken';
      else if (start < 0 || end < 0) error = 'Kilometerstand mag niet negatief zijn';
      else if (end < start) error = 'Eindstand is lager dan de beginstand';
      else distance = Math.round((end - start) * 10) / 10; // the odometers decide, not a typed or calculated total
    }

    // The sheet leaves the character blank on some rows (often the return leg): take it from the previous trip of the
    // same day, otherwise fall back to the chosen default, and say so.
    const rawPurpose = normalize(get('purpose'));
    let purpose: TripPurpose = this.parsePurpose(get('purpose'), defaultPurpose);
    const warnings: string[] = [];
    if (!rawPurpose) {
      if (previous && previous.isValid && previous.date === date && previous.section === section) {
        purpose = previous.purpose;
        warnings.push(`Karakter ontbreekt: overgenomen van de vorige rit (${purposeLabel(purpose)})`);
      } else {
        warnings.push(`Karakter ontbreekt: ingesteld als ${purposeLabel(purpose)}`);
      }
    }
    if ((!from || !to) && purpose !== 'private') warnings.push('Adres ontbreekt');

    const description = [String(get('description') ?? '').trim(), String(get('route') ?? '').trim() ? `Afwijkende route: ${String(get('route')).trim()}` : '']
      .filter(Boolean)
      .join(' — ');

    const record: TripImportRecord = {
      rowNumber,
      date: date ?? '',
      startOdometer: start ?? 0,
      endOdometer: end ?? 0,
      distanceKm: distance ?? 0,
      fromLocation: from,
      toLocation: to,
      purpose,
      description,
      isReturnTrip: this.parseBoolean(get('return')),
      isValid: !error,
      isDuplicate: false,
      section,
      error,
      warning: warnings.length ? warnings.join('; ') : undefined,
    };

    if (record.isValid) {
      const key = `${record.date}|${record.startOdometer}|${record.endOdometer}`;
      record.isDuplicate = seen.has(key) || TripService.exists(vehicleId, record.date, record.startOdometer, record.endOdometer);
      seen.add(key);
    }
    return record;
  }

  // ── Execute ─────────────────────────────────────────────────────────────────

  /** The records come from the browser: validate them again instead of trusting the preview. */
  public static validateRecord(raw: any): Omit<TripImportRecord, 'rowNumber' | 'isDuplicate' | 'isValid' | 'error' | 'warning' | 'section'> | null {
    const date = typeof raw?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? this.parseDate(raw.date) : null;
    const start = Number(raw?.startOdometer);
    const end = Number(raw?.endOdometer);
    const distance = Number(raw?.distanceKm);
    const from = String(raw?.fromLocation ?? '').trim().slice(0, 300);
    const to = String(raw?.toLocation ?? '').trim().slice(0, 300);
    const purpose = ['business', 'commute', 'private'].includes(raw?.purpose) ? (raw.purpose as TripPurpose) : null;
    if (!date || !purpose) return null;
    if (![start, end, distance].every((n) => Number.isFinite(n) && n >= 0) || end < start) return null;
    return {
      date,
      startOdometer: start,
      endOdometer: end,
      distanceKm: distance,
      fromLocation: from,
      toLocation: to,
      purpose,
      description: String(raw?.description ?? '').trim().slice(0, 1000),
      isReturnTrip: raw?.isReturnTrip === true,
    };
  }

  public static execute(
    vehicleId: string,
    userId: string,
    rawRecords: any[],
    skipDuplicates = true
  ): { importedCount: number; skippedDuplicates: number; rejected: number } {
    let importedCount = 0;
    let skippedDuplicates = 0;
    let rejected = 0;
    const seen = new Set<string>();

    db.exec('BEGIN');
    try {
      for (const raw of rawRecords) {
        const rec = this.validateRecord(raw);
        if (!rec) {
          rejected++;
          continue;
        }
        const key = `${rec.date}|${rec.startOdometer}|${rec.endOdometer}`;
        if (skipDuplicates && (seen.has(key) || TripService.exists(vehicleId, rec.date, rec.startOdometer, rec.endOdometer))) {
          skippedDuplicates++;
          continue;
        }
        seen.add(key);
        TripService.insert({
          vehicleId,
          userId,
          date: rec.date,
          startOdometer: rec.startOdometer,
          endOdometer: rec.endOdometer,
          distanceKm: rec.distanceKm,
          fromLocation: rec.fromLocation,
          toLocation: rec.toLocation,
          purpose: rec.purpose,
          description: rec.description,
          isReturnTrip: rec.isReturnTrip,
        });
        importedCount++;
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return { importedCount, skippedDuplicates, rejected };
  }
}
