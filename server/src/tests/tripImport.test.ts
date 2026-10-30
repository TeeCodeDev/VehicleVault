import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { TripController } from '../controllers/tripController.js';
import { TripImportService } from '../services/tripImportService.js';
import { TripExportService } from '../services/tripExportService.js';

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * A workbook laid out like the Belastingdienst "kilometeradministratie" sheet: a name/vehicle block above the
 * table, footnote markers in the headers, formulas in the odometer and distance columns, blank addresses on private
 * trips, a note row, a 0 km row, and a merged row that switches to another car. All data here is made up.
 */
async function buildBelastingdienstSheet(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Blad1');
  ws.addRow(['Naam', 'Test Persoon', 'Burgerservicenummer', '000000000']);
  ws.addRow(['Test Persoon', '', '', '', '', '', 'Totaal Prive KM:', 10]);
  ws.addRow(['Merk Auto', 'Type Auto', 'Kenteken', 'Ter beschikking sinds', 'Ter beschikking tot']);
  ws.addRow(['Testmerk', 'Model X', 'AB-123-C', D('2025-01-01'), D('2027-01-01')]);
  ws.addRow([
    'Datum', 'Rit-nr (1)', 'Beginstand kilometerteller', 'eindstand kilometerteller', 'Aantal kilometers',
    'Beginadres rit (2)', 'Eindadres rit (3)', 'Afwijkende route (4)', 'Karakter van de rit (5)', 'Bijzonderhedden (6)',
  ]);
  // 6: business, odometers as text, calculated distance
  ws.addRow([D('2026-01-23'), '1', '1000', '1004', { formula: 'D6-C6', result: 4 }, 'Straat 1, Plaats', 'Straat 2, Plaats', 'via de ringweg', 'zakelijk', 'Kantoordag']);
  // 7: return leg of the same day, character left blank -> taken from the previous trip
  ws.addRow([D('2026-01-23'), '2', { formula: 'D6', result: 1004 }, '1008', { formula: 'D7-C7', result: 4 }, 'Straat 2, Plaats', 'Straat 1, Plaats', '', '', 'Kantoordag']);
  // 8: private, no addresses at all
  ws.addRow([D('2026-02-18'), '1', { formula: 'D7', result: 1008 }, '1010', { formula: 'D8-C8', result: 2 }, '', '', '', 'Privé', '']);
  // 9: character blank and nothing to inherit -> default (private) with a warning
  ws.addRow([D('2026-02-20'), '1', '1010', '1014', { formula: 'D9-C9', result: 4 }, '', '', '', '', '']);
  // 10: a note below the table, no date
  ws.addRow(['', '', '', 1014, '', '', '', '', '', 'Auto ingeleverd.']);
  // 11: vehicle change, text repeated over merged cells
  const change = ws.addRow(['Testmerk Model X -> WISSELEN LEASEAUTO -> Ander Merk Z (ZZ-999-Z)']);
  ws.mergeCells(`A${change.number}:F${change.number}`);
  // 12: handed over, 0 km
  ws.addRow([D('2026-03-01'), '1', '50', '50', { error: '#VALUE!' as any }, '', '', '', '', 'Auto overgenomen']);
  // 13: date typed as Dutch text, odometers restart in the new car
  ws.addRow(['02-03-2026', '1', '50', '90', { formula: 'D13-C13', result: 40 }, 'Straat 3', 'Straat 4', '', 'Zakelijk', 'Klantbezoek']);
  // 14: end below start
  ws.addRow([D('2026-03-03'), '1', '90', '80', '', 'Straat 3', 'Straat 4', '', 'Zakelijk', 'Typefout']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function mockRes() {
  const res: any = { statusCode: 200, body: null, headers: {} };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (d: unknown) => ((res.body = d), res);
  res.send = (d: unknown) => ((res.body = d), res);
  res.setHeader = (k: string, v: string) => ((res.headers[k] = v), res);
  return res;
}

describe('Trip import (Belastingdienst kilometeradministratie)', () => {
  const owner = crypto.randomUUID();
  const viewer = crypto.randomUUID();
  const stranger = crypto.randomUUID();
  const vehicleId = crypto.randomUUID();
  const now = new Date().toISOString();

  before(() => {
    initializeDatabase();
    for (const id of [owner, viewer, stranger]) {
      db.run('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, `${id}@trips.test`, 'x', 'user', now, now]);
    }
    db.run(
      `INSERT INTO vehicles (id, user_id, name, type, license_plate, year, make, model, fuel_type, purchase_date, purchase_price, initial_odometer, status, created_at, updated_at)
       VALUES (?, ?, 'Testauto', 'car', 'AB-123-C', 2024, 'Testmerk', 'Model X', 'Electric', '2025-01-01', 1, 0, 'active', ?, ?)`,
      [vehicleId, owner, now, now]
    );
    db.run('INSERT INTO vehicle_shares (id, vehicle_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)', [crypto.randomUUID(), vehicleId, viewer, 'viewer', now]);
  });

  after(() => {
    db.run('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
    for (const id of [owner, viewer, stranger]) db.run('DELETE FROM users WHERE id = ?', [id]);
  });

  describe('Reading values', () => {
    it('reads Dutch dates and numbers', () => {
      assert.equal(TripImportService.parseDate('23-01-2026'), '2026-01-23');
      assert.equal(TripImportService.parseDate('3-2-26'), '2026-02-03');
      assert.equal(TripImportService.parseDate('2026-01-23'), '2026-01-23');
      assert.equal(TripImportService.parseDate(D('2026-01-23')), '2026-01-23');
      assert.equal(TripImportService.parseDate(46045), '2026-01-23');
      assert.equal(TripImportService.parseDate('31-02-2026'), null);
      assert.equal(TripImportService.parseDate('geen datum'), null);
      assert.equal(TripImportService.parseNumber('68277'), 68277);
      assert.equal(TripImportService.parseNumber('1.234,5'), 1234.5);
      assert.equal(TripImportService.parseNumber('12.345'), 12345);
      assert.equal(TripImportService.parseNumber('12 345 km'), 12345);
      assert.equal(TripImportService.parseNumber('x'), null);
    });

    it('reads purposes however they are spelled', () => {
      for (const v of ['zakelijk', 'Zakelijk', 'ZAKELIJK']) assert.equal(TripImportService.parsePurpose(v, 'private'), 'business');
      for (const v of ['Privé', 'prive', 'Prive rit', 'Particulier']) assert.equal(TripImportService.parsePurpose(v, 'business'), 'private');
      assert.equal(TripImportService.parsePurpose('Woon-werk', 'private'), 'commute');
      assert.equal(TripImportService.parsePurpose('', 'private'), 'private');
    });

    it('parses CSV with quotes, doubled quotes, a BOM and either delimiter', () => {
      const semi = TripImportService.parseCsv('﻿Datum;Naar;Opmerking\r\n"23-01-2026";"\'s-Hertogenbosch";"zei ""hoi"""\r\n');
      assert.deepEqual(semi, [['Datum', 'Naar', 'Opmerking'], ['23-01-2026', "'s-Hertogenbosch", 'zei "hoi"']]);
      const comma = TripImportService.parseCsv('Datum,Naar\n23-01-2026,"Plaats, Straat 1"\n');
      assert.deepEqual(comma[1], ['23-01-2026', 'Plaats, Straat 1']);
    });
  });

  describe('Belastingdienst workbook', () => {
    it('finds the table below the title block and maps the headers with footnote markers', async () => {
      const p = await TripImportService.preview(await buildBelastingdienstSheet(), vehicleId, { vehiclePlate: 'AB-123-C' });
      assert.equal(p.format, 'xlsx');
      assert.deepEqual(p.missingRequired, []);
      assert.equal(p.mapping.from, 'Beginadres rit (2)');
      assert.equal(p.mapping.to, 'Eindadres rit (3)');
      assert.equal(p.mapping.start, 'Beginstand kilometerteller');
      assert.equal(p.mapping.purpose, 'Karakter van de rit (5)');
      assert.equal(p.mapping.description, 'Bijzonderhedden (6)');
    });

    it('imports the trips, takes formulas at their result and keeps blank addresses blank', async () => {
      const p = await TripImportService.preview(await buildBelastingdienstSheet(), vehicleId, { vehiclePlate: 'AB-123-C' });
      const byRow = (n: number) => p.records.find((r) => r.rowNumber === n)!;

      assert.equal(byRow(6).date, '2026-01-23');
      assert.equal(byRow(6).startOdometer, 1000);
      assert.equal(byRow(6).distanceKm, 4);
      assert.equal(byRow(6).purpose, 'business');
      assert.match(byRow(6).description, /Kantoordag — Afwijkende route: via de ringweg/);
      assert.equal(byRow(7).startOdometer, 1004); // formula cell
      assert.equal(byRow(8).fromLocation, '');
      assert.equal(byRow(8).purpose, 'private');
      assert.equal(byRow(13).date, '2026-03-02'); // typed as text
    });

    it('takes a blank character from the previous trip of the day, else the default, and says so', async () => {
      const p = await TripImportService.preview(await buildBelastingdienstSheet(), vehicleId);
      const byRow = (n: number) => p.records.find((r) => r.rowNumber === n)!;
      assert.equal(byRow(7).purpose, 'business');
      assert.match(byRow(7).warning!, /overgenomen/);
      assert.equal(byRow(9).purpose, 'private');
      assert.match(byRow(9).warning!, /ingesteld als privé/);

      const asBusiness = await TripImportService.preview(await buildBelastingdienstSheet(), vehicleId, { defaultPurpose: 'business' });
      assert.equal(asBusiness.records.find((r) => r.rowNumber === 9)!.purpose, 'business');
    });

    it('leaves notes and 0 km rows out, flags impossible rows, and never lets them become trips', async () => {
      const p = await TripImportService.preview(await buildBelastingdienstSheet(), vehicleId);
      assert.deepEqual(p.ignoredRows.map((r) => r.rowNumber), [10, 12]);
      assert.match(p.ignoredRows[1].reason, /0 km/);
      const bad = p.records.find((r) => r.rowNumber === 14)!;
      assert.equal(bad.isValid, false);
      assert.match(bad.error!, /Eindstand is lager/);
      assert.equal(p.errorRows, 1);
      assert.equal(p.validRows, p.records.length - 1);
    });

    it('splits the file at a vehicle change and matches each block to the plate', async () => {
      const p = await TripImportService.preview(await buildBelastingdienstSheet(), vehicleId, { vehiclePlate: 'ab123c' });
      assert.equal(p.sections.length, 2);
      assert.deepEqual(
        p.sections.map((s) => [s.label, s.plate, s.plateMatches, s.rows]),
        [
          ['Testmerk Model X (AB-123-C)', 'AB-123-C', true, 4],
          ['Ander Merk Z (ZZ-999-Z)', 'ZZ-999-Z', false, 1],
        ]
      );
      assert.deepEqual([...new Set(p.records.map((r) => r.section))], [0, 1]);
    });
  });

  describe('Round trip with the VehicleVault export', () => {
    const trips = [
      { id: '1', date: '2026-04-01', start_odometer: 100, end_odometer: 112.5, distance_km: 12.5, from_location: "'s-Hertogenbosch, Dorpsstraat 1", to_location: 'Zwolle', purpose: 'business' as const, description: 'Klant; "Nieuw"', is_return_trip: 0 },
      { id: '2', date: '2026-04-02', start_odometer: 112.5, end_odometer: 130, distance_km: 17.5, from_location: 'Zwolle', to_location: 'Thuis', purpose: 'private' as const, description: '', is_return_trip: 1 },
    ];

    it('imports the Excel export', async () => {
      const buffer = await TripExportService.generateExcel({ name: 'Testauto', license_plate: 'AB-123-C' }, trips, '2026');
      const p = await TripImportService.preview(buffer, vehicleId);
      assert.deepEqual(p.missingRequired, []);
      assert.equal(p.validRows, 2);
      assert.deepEqual(
        p.records.map((r) => [r.date, r.startOdometer, r.endOdometer, r.fromLocation, r.toLocation, r.purpose, r.isReturnTrip]),
        [
          ['2026-04-01', 100, 112.5, "'s-Hertogenbosch, Dorpsstraat 1", 'Zwolle', 'business', false],
          ['2026-04-02', 112.5, 130, 'Zwolle', 'Thuis', 'private', true],
        ]
      );
    });

    it('imports the CSV export', async () => {
      const req: any = { query: { vehicleId, year: '2026' }, user: { userId: owner } };
      for (const t of trips) {
        db.run(
          `INSERT INTO trips (id, vehicle_id, user_id, date, start_odometer, end_odometer, distance_km, from_location, to_location, purpose, description, is_return_trip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), vehicleId, owner, t.date, t.start_odometer, t.end_odometer, t.distance_km, t.from_location, t.to_location, t.purpose, t.description, t.is_return_trip, now]
        );
      }
      const res = mockRes();
      await TripController.exportCsv(req, res);
      db.run('DELETE FROM trips WHERE vehicle_id = ?', [vehicleId]);

      const p = await TripImportService.preview(Buffer.from(res.body as string, 'utf-8'), vehicleId);
      assert.equal(p.format, 'csv');
      assert.equal(p.validRows, 2);
      assert.equal(p.records[0].description, 'Klant; "Nieuw"');
      assert.equal(p.records[0].fromLocation, "'s-Hertogenbosch, Dorpsstraat 1");
      assert.equal(p.records[1].purpose, 'private');
      assert.equal(p.records[1].isReturnTrip, true);
    });

    it('lets the user map the columns by hand when the headers are unknown', async () => {
      const csv = 'Wanneer;Van;Naar;Km begin;Km eind\n01-04-2026;A;B;10;25\n';
      const auto = await TripImportService.preview(Buffer.from(csv), vehicleId);
      assert.ok(auto.missingRequired.includes('date'));
      const manual = await TripImportService.preview(Buffer.from(csv), vehicleId, {
        mapping: { date: 'Wanneer', from: 'Van', to: 'Naar', start: 'Km begin', end: 'Km eind' },
      });
      assert.equal(manual.validRows, 1);
      assert.equal(manual.records[0].distanceKm, 15);
    });

    it('refuses an old .xls file with a clear message', () => {
      const xls = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      assert.throws(() => TripImportService.detectFormat(xls), /\.xlsx of \.csv/);
    });
  });

  describe('Importing for real', () => {
    const records = [
      { date: '2026-05-01', startOdometer: 10, endOdometer: 20, distanceKm: 10, fromLocation: 'A', toLocation: 'B', purpose: 'business', description: 'x', isReturnTrip: false },
      { date: '2026-05-02', startOdometer: 20, endOdometer: 30, distanceKm: 10, fromLocation: '', toLocation: '', purpose: 'private', description: '', isReturnTrip: false },
      { date: 'kapot', startOdometer: 1, endOdometer: 2, distanceKm: 1, fromLocation: 'A', toLocation: 'B', purpose: 'business' },
      { date: '2026-05-03', startOdometer: 40, endOdometer: 30, distanceKm: 10, fromLocation: 'A', toLocation: 'B', purpose: 'business' },
      { date: '2026-05-04', startOdometer: 1, endOdometer: 2, distanceKm: 1, fromLocation: 'A', toLocation: 'B', purpose: 'hacker' },
    ];
    const count = () => db.get<{ n: number }>('SELECT COUNT(*) as n FROM trips WHERE vehicle_id = ?', [vehicleId])!.n;

    it('stores valid records, rejects invalid ones and skips duplicates on a second run', async () => {
      const first = mockRes();
      await TripController.importExecute({ body: { vehicleId, records }, user: { userId: owner } } as any, first);
      assert.equal(first.statusCode, 200);
      assert.deepEqual([first.body.importedCount, first.body.skippedDuplicates, first.body.rejected], [2, 0, 3]);
      assert.equal(count(), 2);

      const second = mockRes();
      await TripController.importExecute({ body: { vehicleId, records }, user: { userId: owner } } as any, second);
      assert.deepEqual([second.body.importedCount, second.body.skippedDuplicates], [0, 2]);
      assert.equal(count(), 2);

      const row = db.get<any>("SELECT * FROM trips WHERE vehicle_id = ? AND date = '2026-05-02'", [vehicleId])!;
      assert.equal(row.from_location, '');
      assert.equal(row.user_id, owner);
    });

    it('only lets someone with edit rights import', async () => {
      const before = count();
      for (const [userId, status] of [[viewer, 403], [stranger, 404]] as const) {
        const res = mockRes();
        await TripController.importExecute({ body: { vehicleId, records: [{ ...records[0], date: '2027-01-01' }] }, user: { userId } } as any, res);
        assert.equal(res.statusCode, status);
        const preview = mockRes();
        await TripController.importPreview({ body: { vehicleId }, file: { buffer: Buffer.from('Datum\n') }, user: { userId } } as any, preview);
        assert.equal(preview.statusCode, status);
      }
      assert.equal(count(), before);
    });

    it('rejects a request without a file or without records', async () => {
      const noFile = mockRes();
      await TripController.importPreview({ body: { vehicleId }, user: { userId: owner } } as any, noFile);
      assert.equal(noFile.statusCode, 400);
      const noRecords = mockRes();
      await TripController.importExecute({ body: { vehicleId, records: [] }, user: { userId: owner } } as any, noRecords);
      assert.equal(noRecords.statusCode, 400);
    });
  });
});
