import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { ImportService } from '../services/importService.js';

describe('Fuelio Real Export Parser & Importer', () => {
  const sampleFuelioCsv = `"## Vehicle"
"Name","Description","DistUnit","FuelUnit","ConsumptionUnit","ImportCSVDateFormat","VIN","Insurance","Plate","Make","Model","Year","TankCount","Tank1Type","Tank2Type","Active","Tank1Capacity","Tank2Capacity","FuelUnitTank2","FuelConsumptionTank2"
"Honda NT650V Deauville ","","0","0","3","yyyy-MM-dd","","","MZ-FF-07","Honda","NT650V Deauville ","2004","1","100","0","1","19.0","0.0","0","0"
"## Log"
"Data","Odo (km)","Fuel (litres)","Full","Price (optional)","km/l (optional)","latitude (optional)","longitude (optional)","City (optional)","Notes (optional)","Missed","TankNumber","FuelType","VolumePrice","StationID (optional)","ExcludeDistance","UniqueId","TankCalc"
"2026-10-14 08:05","52302.0","6.92","1","15.42","20.09","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.229","913526","0.0","81","0.0"
"2026-10-13 08:02","52163.0","10.88","1","24.36","20.86","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.239","913526","0.0","80","0.0"
"2026-10-06 08:43","51936.0","8.46","1","20.3","22.46","53.1107","6.13477","Drachten - NXT","","0","1","110","2.399","772622","0.0","79","0.0"
"2026-10-05 08:13","51746.0","7.52","1","16.76","22.21","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.229","913526","0.0","78","0.0"
"2026-10-02 10:58","51579.0","12.12","1","28.3","21.37","52.69949","6.16987","Meppel - Joontjes","","0","1","110","2.335","174868","0.0","77","0.0"
"2026-09-28 08:07","51320.0","13.11","1","29.75","20.75","52.80363","6.12901","Eesveen - Fieten ","","0","1","110","2.269","913526","0.0","76","0.0"
"2026-09-21 08:17","51048.0","12.89","1","29.12","21.41","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.259","913526","0.0","75","0.0"
"2026-09-08 08:10","50772.0","13.58","1","30.95","20.32","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.279","913526","0.0","74","0.0"
"2026-08-25 08:14","50496.0","11.32","1","24.44","19.35","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.159","913526","0.0","73","0.0"
"2026-07-25 12:58","50277.0","12.49","1","29.34","21.93","53.1107","6.13477","Drachten - NXT","","0","1","110","2.349","772622","0.0","72","0.0"
"2026-07-21 08:03","50003.0","13.1","1","28.54","20.24","52.75981","6.23461","Havelte - Kreuze","","0","1","110","2.179","1001893","0.0","71","0.0"
"2026-07-14 08:20","49738.0","12.42","1","26.44","21.74","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.129","913526","0.0","70","0.0"
"2026-07-07 08:14","49468.0","13.7","1","28.48","20.08","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.079","913526","0.0","69","0.0"
"2026-06-30 08:15","49193.0","13.44","1","27.4","20.37","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.039","913526","0.0","68","0.0"
"2026-06-23 08:13","48919.0","1163.0","1","2394.62","0.2","52.80363","6.12901","Eesveen - Fieten ","","0","1","110","2.059","913526","0.0","67","0.0"
"2026-06-16 08:45","48691.0","11.3","1","24.51","20.62","53.1107","6.13477","Drachten - NXT","","0","1","110","2.169","772622","0.0","66","0.0"
"2026-05-26 16:57","48458.0","12.46","1","27.65","20.7","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","2.219","913526","0.0","65","0.0"
"2026-05-05 17:09","48200.0","14.28","1","32.1","19.19","52.69949","6.16987","Meppel - Joontjes","","0","1","110","2.248","174868","0.0","64","0.0"
"2026-04-18 14:41","47926.0","9.79","1","21.21","19.8","52.69949","6.16987","Meppel - Joontjes","","0","1","110","2.167","174868","0.0","63","0.0"
"2026-03-24 08:16","47732.0","11.98","1","25.86","19.8","52.80363","6.12901","Eesveen - Fieten ","","0","1","110","2.159","913526","0.0","62","0.0"
"2025-12-05 13:17","47495.0","13.36","1","23.63","20.04","52.75981","6.23461","Havelte - Kreuze","","0","1","110","1.769","1001893","0.0","61","0.0"
"2025-11-04 08:19","47227.0","10.65","1","18.31","17.54","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","1.719","913526","0.0","60","0.0"
"2025-10-11 11:06","47040.0","12.9","1","23.98","21.46","52.72133","6.48569","Hoogeveen - Haan","","0","1","110","1.859","493942","0.0","59","0.0"
"2025-09-30 17:48","46763.0","7.46","1","13.19","20.37","52.75981","6.23461","Havelte - Kreuze","","0","1","110","1.768","1001893","0.0","58","0.0"
"2025-08-29 15:37","46611.0","12.08","1","22.2","21.69","52.69949","6.16987","Meppel - Joontjes","","0","1","110","1.838","174868","0.0","57","0.0"
"2025-08-24 15:47","46349.0","8.15","1","14.98","20.12","52.69949","6.16987","Meppel - Joontjes","","0","1","110","1.838","174868","0.0","56","0.0"
"2025-07-25 16:45","46185.0","15.91","1","27.67","19.05","52.68765","6.27117","Rogat - Fieten Olie De Wijk ","Tank echt leeg. Afgeslagen. ","0","1","110","1.739","655715","0.0","55","0.0"
"2025-07-15 08:18","45882.0","13.86","1","23.27","20.49","52.80363","6.12901","Steenwijk - Fieten ","","0","1","110","1.679","913526","0.0","54","0.0"
"2025-07-01 08:43","45598.0","13.49","1","25.48","20.33","53.1107","6.13477","Drachten - NXT","","0","1","110","1.889","772622","0.0","53","0.0"
"2025-06-29 10:58","45324.0","12.62","1","22.32","21.79","53.6912","7.81861","Wittmund - Carolinensiel","","0","1","110","1.769","904057","0.0","52","0.0"
"2025-06-17 16:23","45049.0","11.78","1","22.13","21.23","53.11443","6.14155","Drachten - TinQ station","","0","1","110","1.879","174719","0.0","51","0.0"
"2025-06-04 18:31","44799.0","12.96","1","23.52","21.23","52.69949","6.16987","Meppel - Joontjes","","0","1","110","1.815","174868","0.0","50","0.0"
"2025-05-19 07:58","44524.0","13.85","1","25.05","20.2","52.69316","6.1809","Meppel - Tamoil","","0","1","110","1.809","429912","0.0","49","0.0"
"2025-04-29 17:12","44244.3","14.96","1","27.3","20.75","52.69949","6.16987","Meppel - Joontjes","","0","1","110","1.825","174868","0.0","48","0.0"
"2025-04-11 10:25","43934.0","12.84","1","23.69","20.88","52.69949","6.16987","Meppel - Joontjes","","0","1","110","1.845","174868","0.0","47","0.0"
"2025-03-23 17:37","43666.0","13.57","1","25.04",,"52.69949","6.16987","Joontjes - Meppel","","0","1","110","1.845","174868","0.0","46","0.0"
"## Category"
"IdCategory","Name"
"1","Privé"
"2","Werk"
`;

  const testUserId = crypto.randomUUID();
  const testVehicleId = crypto.randomUUID();

  before(() => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [testUserId, `fuelio-user-${Date.now()}@test.local`, 'hash', 'admin', now, now]
    );
    db.run(
      `INSERT INTO vehicles (id, user_id, name, make, model, year, license_plate, initial_odometer, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testVehicleId, testUserId, 'Honda Test Deauville', 'Honda', 'NT650V Deauville', 2004, 'MZ-FF-07', 40000, now, now]
    );
  });

  after(() => {
    db.run('DELETE FROM fuel_entries WHERE vehicle_id = ?', [testVehicleId]);
    db.run('DELETE FROM vehicles WHERE id = ?', [testVehicleId]);
    db.run('DELETE FROM users WHERE id = ?', [testUserId]);
  });

  it('detects Fuelio format and extracts vehicle metadata correctly', () => {
    const preview = ImportService.previewImport(sampleFuelioCsv, testVehicleId);

    assert.equal(preview.detectedFormat, 'fuelio');
    assert.ok(preview.vehicleInfo);
    assert.equal(preview.vehicleInfo.plate, 'MZ-FF-07');
    assert.equal(preview.vehicleInfo.make, 'Honda');
    assert.equal(preview.vehicleInfo.model, 'NT650V Deauville');
    assert.equal(preview.vehicleInfo.year, 2004);
    assert.equal(preview.vehicleInfo.tankCapacity, 19.0);
  });

  it('parses all 36 fuel logs accurately without including Category section', () => {
    const preview = ImportService.previewImport(sampleFuelioCsv, testVehicleId);

    assert.equal(preview.totalRows, 36);
    assert.equal(preview.validRows, 36);
    assert.equal(preview.errorRows, 0);

    // Verify first row
    const first = preview.records[0];
    assert.equal(first.date, '2026-10-14');
    assert.equal(first.odometer, 52302.0);
    assert.equal(first.liters, 6.92);
    assert.equal(first.totalCost, 15.42);
    assert.equal(first.pricePerLiter, 2.229);
    assert.equal(first.stationName, 'Steenwijk - Fieten');
    assert.equal(first.latitude, 52.80363);
    assert.equal(first.longitude, 6.12901);
    assert.equal(first.isFullTank, true);

    // Verify row with custom note (row 26: 2025-07-25)
    const notedRow = preview.records.find((r) => r.odometer === 46185.0);
    assert.ok(notedRow);
    assert.equal(notedRow.stationName, 'Rogat - Fieten Olie De Wijk');
    assert.equal(notedRow.notes, 'Tank echt leeg. Afgeslagen.');
    assert.equal(notedRow.totalCost, 27.67);
    assert.equal(notedRow.pricePerLiter, 1.739);
  });

  it('commits records into fuel_entries and skips duplicates gracefully', () => {
    const preview = ImportService.previewImport(sampleFuelioCsv, testVehicleId);
    const result1 = ImportService.executeImport(testVehicleId, preview.records);

    assert.equal(result1.importedCount, 36);
    assert.equal(result1.skippedCount, 0);

    // Re-importing should skip duplicates safely
    const result2 = ImportService.executeImport(testVehicleId, preview.records);
    assert.equal(result2.importedCount, 0);
    assert.equal(result2.skippedCount, 36);

    // Verify in database
    const entries = db.query<{ id: string; station_name: string; total_cost: number }>(
      'SELECT id, station_name, total_cost FROM fuel_entries WHERE vehicle_id = ? ORDER BY odometer DESC',
      [testVehicleId]
    );
    assert.equal(entries.length, 36);
    assert.equal(entries[0].station_name, 'Steenwijk - Fieten');
    assert.equal(entries[0].total_cost, 15.42);
  });
});

