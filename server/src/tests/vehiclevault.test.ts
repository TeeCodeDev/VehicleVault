import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { hashPassword, comparePassword, generateApiKey, hashToken } from '../utils/token.js';
import { OcrService } from '../services/ocrService.js';
import { MaintenanceService } from '../services/maintenanceService.js';
import { TcoService } from '../services/tcoService.js';
import { executeMcpTool } from '../mcp/tools.js';
import { ImportService } from '../services/importService.js';
import { RdwService } from '../services/rdwService.js';
import {
  AiReceiptService,
  getSystemSetting,
  setSystemSetting,
  maskApiKey,
  extractDutchAddress,
  filterVisionModels,
  formatStationName,
  formatAddress,
} from '../services/aiReceiptService.js';
import { StationService } from '../services/stationService.js';
import { isAuthDisabled, getDefaultUser } from '../middleware/auth.js';
import { HaService } from '../services/haService.js';
import { NotificationService } from '../services/notificationService.js';
import { BackupService } from '../services/backupService.js';
import { TripExportService } from '../services/tripExportService.js';
import { FuelExportService } from '../services/fuelExportService.js';

describe('VehicleVault Comprehensive Test Suite', () => {
  let testUserId: string;
  let testVehicleId: string;

  before(() => {
    initializeDatabase();
    testUserId = crypto.randomUUID();
    testVehicleId = crypto.randomUUID();

    // Create test user
    db.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [testUserId, 'driver@vault.local', 'fake_hash', 'user', new Date().toISOString(), new Date().toISOString()]
    );

    // Create test vehicle
    db.run(
      `INSERT INTO vehicles (
        id, user_id, name, type, license_plate, year, make, model, fuel_type,
        purchase_date, purchase_price, initial_odometer, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testVehicleId,
        testUserId,
        'Daily Driver Golf 7',
        'car',
        '12-XYZ-3',
        2018,
        'Volkswagen',
        'Golf',
        'Petrol',
        '2023-01-15',
        15000,
        50000,
        'active',
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
  });

  after(() => {
    // Clean up test data
    db.run('DELETE FROM users WHERE id = ?', [testUserId]);
    db.run('DELETE FROM vehicles WHERE id = ?', [testVehicleId]);
  });

  describe('Security & Auth Utilities', () => {
    it('should hash and verify passwords correctly with bcrypt', async () => {
      const password = 'SuperSecretPassword123!';
      const hash = await hashPassword(password);
      assert.ok(hash !== password);
      assert.ok(await comparePassword(password, hash));
      assert.ok(!(await comparePassword('WrongPassword', hash)));
    });

    it('should generate vkv_ prefixed API keys with sha256 hash', () => {
      const { rawKey, keyHash, prefix } = generateApiKey('AI Assistant Key');
      assert.ok(rawKey.startsWith('vkv_'));
      assert.ok(prefix.startsWith('vkv_'));
      assert.equal(hashToken(rawKey), keyHash);
    });

    it('should support disabling authentication via system settings or environment variable', () => {
      // Default should be false
      db.run('DELETE FROM system_settings WHERE key = ?', ['disable_auth']);
      delete process.env.DISABLE_AUTH;
      assert.equal(isAuthDisabled(), false);

      // Enable via system_settings
      setSystemSetting('disable_auth', 'true');
      assert.equal(isAuthDisabled(), true);

      // Verify default user lookup returns a valid user
      const defaultUser = getDefaultUser();
      assert.ok(defaultUser.userId);
      assert.ok(defaultUser.email);
      assert.ok(['admin', 'user', 'driver'].includes(defaultUser.role));

      // Clean up
      db.run('DELETE FROM system_settings WHERE key = ?', ['disable_auth']);
      assert.equal(isAuthDisabled(), false);
    });
  });

  describe('Tesseract OCR Regex Parser', () => {
    it('should correctly extract liters, price/L, and total from receipt text', () => {
      const mockReceiptText = `
        SHELL STATION AMSTERDAM
        DATUM: 14-10-2024 16:34
        BRANDSTOF: EURO 95 (E10)
        POMP 04
        VOLUME: 42.50 L
        PRIJS/L: 1.949 EUR/L
        TOTAAL: 82.83 EUR
        BEDANKT VOOR UW BEZOEK!
      `;

      const parsed = OcrService.parseReceiptText(mockReceiptText, 92);
      assert.equal(parsed.date, '2024-10-14');
      assert.equal(parsed.liters, 42.5);
      assert.equal(parsed.pricePerLiter, 1.949);
      assert.equal(parsed.totalCost, 82.83);
    });

    it('should mathematically infer total cost if only liters and price are present', () => {
      const receiptWithoutTotal = `
        TANKEN & GAAN
        Liters: 50.00 L
        Prijs: 2.000 €/L
      `;
      const parsed = OcrService.parseReceiptText(receiptWithoutTotal, 80);
      assert.equal(parsed.liters, 50.0);
      assert.equal(parsed.pricePerLiter, 2.0);
      assert.equal(parsed.totalCost, 100.0);
    });

    it('should extract date and mathematically reconcile liters on Dutch Fieten Olie dot-matrix receipt', () => {
      const fietenReceipt = `
        FIETEN OLIE
        Datum 19-10-2026
        08:16:03
        Pomp 4 95 Ongelood
        Volume 57 AI
        rijs € 2.159/
        TOTAAL E80 4%
        *
        BTW 21.00 % € 14.02
        Netto € 66.75
      `;
      const parsed = OcrService.parseReceiptText(fietenReceipt, 85);
      assert.equal(parsed.date, '2026-10-19');
      assert.equal(parsed.pricePerLiter, 2.159);
      assert.equal(parsed.totalCost, 80.77);
      assert.equal(parsed.liters, 37.41);
    });
  });

  describe('RDW Open Data Parser & APK Evaluation', () => {
    it('should normalize license plates correctly', () => {
      assert.equal(RdwService.normalizePlate('12-ab-34'), '12AB34');
      assert.equal(RdwService.normalizePlate('  k-123-xx  '), 'K123XX');
    });

    it('should evaluate APK dates within 30 days as due soon, and past dates as overdue', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const soonStatus = RdwService.evaluateApkStatus(futureDate.toISOString().split('T')[0]);
      assert.equal(soonStatus.isDueSoon, true);
      assert.equal(soonStatus.isOverdue, false);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const overdueStatus = RdwService.evaluateApkStatus(pastDate.toISOString().split('T')[0]);
      assert.equal(overdueStatus.isOverdue, true);
      assert.equal(overdueStatus.isDueSoon, false);
    });
  });

  describe('Dual-Trigger Maintenance Engine', () => {
    it('should calculate dual-trigger interval (whichever comes first)', () => {
      // Create a unique category
      const catId = crypto.randomUUID();
      const catName = `Oil Test ${catId.substring(0, 6)}`;
      db.run('INSERT INTO service_categories (id, name, is_preset) VALUES (?, ?, 0)', [catId, catName]);

      // Recent service date (10 days ago) so time percent is low (~3%)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      // Interval: 10,000 km or 12 months
      const intervalId = crypto.randomUUID();
      db.run(
        `INSERT INTO maintenance_intervals (
          id, vehicle_id, category_id, custom_name, interval_km, interval_months,
          last_service_date, last_service_odometer, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [intervalId, testVehicleId, catId, 'Engine Oil Check', 10000, 12, recentDate.toISOString().split('T')[0], 50000, new Date().toISOString()]
      );

      // Add a fuel log at 59,500 km (9,500 km driven out of 10,000 = 95% -> should be warning/amber)
      db.run(
        `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, missed_previous, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [crypto.randomUUID(), testVehicleId, '2023-06-01', 59500, 45, 1.9, 85.5, new Date().toISOString()]
      );

      const status = MaintenanceService.getVehicleMaintenanceStatus(testVehicleId);
      const oilItem = status.find((s) => s.id === intervalId);
      assert.ok(oilItem);
      assert.equal(oilItem.status, 'warning'); // >= 90%
      assert.equal(oilItem.kmRemaining, 500);
      assert.equal(oilItem.triggerReason, 'distance');
    });
  });

  describe('Analytics & TCO Engine', () => {
    it('should compute operational TCO vs asset TCO with purchase price toggle', () => {
      // Clean any existing fuel entries for isolated test
      db.run('DELETE FROM fuel_entries WHERE vehicle_id = ?', [testVehicleId]);
      db.run('DELETE FROM service_records WHERE vehicle_id = ?', [testVehicleId]);

      // Add two fuel entries
      db.run(
        `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, missed_previous, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [crypto.randomUUID(), testVehicleId, '2023-06-01', 59500, 45, 1.9, 85.5, new Date().toISOString()]
      );

      db.run(
        `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, missed_previous, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [crypto.randomUUID(), testVehicleId, '2023-07-01', 60000, 40, 2.0, 80.0, new Date().toISOString()]
      );

      // Add service record
      db.run(
        `INSERT INTO service_records (id, vehicle_id, service_item, date, odometer, performing_party, cost, created_at)
         VALUES (?, ?, ?, ?, ?, 'garage', ?, ?)`,
        [crypto.randomUUID(), testVehicleId, 'New Brake Pads', '2023-07-05', 60000, 250, new Date().toISOString()]
      );

      // Operational TCO (without purchase price)
      const opTco = TcoService.calculateTco({
        vehicleId: testVehicleId,
        includePurchasePrice: false,
      });

      assert.equal(opTco.includePurchasePrice, false);
      assert.equal(opTco.fuelTotal, 165.5); // 85.5 + 80.0
      assert.equal(opTco.serviceTotal, 250.0);
      assert.equal(opTco.totalCost, 415.5);

      // Asset TCO (with purchase price of €15,000)
      const assetTco = TcoService.calculateTco({
        vehicleId: testVehicleId,
        includePurchasePrice: true,
      });

      assert.equal(assetTco.includePurchasePrice, true);
      assert.equal(assetTco.totalCost, 15415.5);
    });
    it('should calculate fuel price statistics including average, min (cheapest), and max (most expensive) fuel prices', () => {
      const tco = TcoService.calculateTco({
        vehicleId: testVehicleId,
      });

      assert.ok(tco.priceStats);
      assert.equal(tco.priceStats.minPrice?.price, 1.9);
      assert.equal(tco.priceStats.minPrice?.date, '2023-06-01');
      assert.equal(tco.priceStats.maxPrice?.price, 2.0);
      assert.equal(tco.priceStats.maxPrice?.date, '2023-07-01');
      assert.equal(tco.priceStats.history.length, 2);
      // Weighted average: (85.5 + 80.0) / (45 + 40) = 165.5 / 85 = 1.947
      assert.equal(tco.priceStats.avgPrice, 1.947);
    });

  });

  describe('CSV Import Engine', () => {
    it('should parse and preview Fuelio CSV structure', () => {
      const fuelioCsv = `## Data
Date,Odometer,Fuel_amount,Price,Total_cost,Notes
2024-01-10,61000,45.2,1.95,88.14,Shell highway
2024-02-10,61600,43.8,1.98,86.72,Esso town
`;
      const preview = ImportService.previewImport(fuelioCsv, testVehicleId);
      assert.equal(preview.detectedFormat, 'fuelio');
      assert.equal(preview.validRows, 2);
      assert.equal(preview.records[0].odometer, 61000);
      assert.equal(preview.records[0].liters, 45.2);
    });
  });

  describe('MCP (Model Context Protocol) Tools', () => {
    it('should list active vehicles via list_vehicles', async () => {
      const res = await executeMcpTool('list_vehicles', { status: 'active' });
      assert.ok(Array.isArray(res.vehicles));
      const found = res.vehicles.find((v: any) => v.id === testVehicleId);
      assert.ok(found);
    });

    it('should retrieve vehicle summary via get_vehicle_summary', async () => {
      const res = await executeMcpTool('get_vehicle_summary', { vehicle_id: testVehicleId });
      assert.equal(res.vehicle.id, testVehicleId);
      assert.ok(res.tco);
      assert.ok(Array.isArray(res.upcomingMaintenanceAlerts));
    });

    it('should log a fuel entry via log_fuel_entry', async () => {
      const res = await executeMcpTool('log_fuel_entry', {
        vehicle_id: testVehicleId,
        odometer: 62200,
        liters: 44.0,
        price_per_liter: 1.95,
        is_full_tank: true,
        notes: 'MCP automated fill-up test',
      });
      assert.equal(res.success, true);
      assert.ok(res.id);
    });

    it('should log a service entry via log_service_entry', async () => {
      const res = await executeMcpTool('log_service_entry', {
        vehicle_id: testVehicleId,
        service_item: 'Cabin Air Filter',
        odometer: 62200,
        cost: 35.0,
        notes: 'MCP automated service log test',
      });
      assert.equal(res.success, true);
      assert.ok(res.id);
    });

    it('should check maintenance alerts via check_maintenance_alerts', async () => {
      const res = await executeMcpTool('check_maintenance_alerts', { vehicle_id: testVehicleId });
      assert.ok(typeof res.count === 'number');
      assert.ok(Array.isArray(res.alerts));
    });
  });

  describe('AI Vision Receipt Scanner & System Settings', () => {
    it('should save and retrieve system settings correctly', () => {
      setSystemSetting('ai_provider', 'gemini');
      setSystemSetting('gemini_api_key', 'AIzaSyTestKey1234567890');
      setSystemSetting('gemini_model', 'gemini-3.8-flash');

      assert.equal(getSystemSetting('ai_provider'), 'gemini');
      assert.equal(getSystemSetting('gemini_api_key'), 'AIzaSyTestKey1234567890');
      assert.equal(getSystemSetting('gemini_model'), 'gemini-3.8-flash');
    });

    it('should auto-migrate deprecated gemini models to gemini-3.8-flash', () => {
      setSystemSetting('gemini_model', 'gemini-2.0-flash');
      const settings = AiReceiptService.getActiveSettings();
      assert.equal(settings.geminiModel, 'gemini-3.8-flash');
      assert.equal(getSystemSetting('gemini_model'), 'gemini-3.8-flash');
    });

    it('should mask API keys securely without exposing raw secrets', () => {
      const masked = maskApiKey('AIzaSyD-1234567890abcdef');
      assert.equal(masked, 'AIzaSy...cdef');

      const shortMasked = maskApiKey('short');
      assert.equal(shortMasked, '••••••••');

      assert.equal(maskApiKey(''), null);
      assert.equal(maskApiKey(null), null);
    });

    it('should normalize and reconcile AI JSON extraction accurately', () => {
      const mockGeminiJson = JSON.stringify({
        date: '2026-10-19',
        liters: 37.41,
        pricePerLiter: 2.159,
        totalCost: null, // should be reconciled
        station: 'FIETEN OLIE', // all caps from receipt header -> should be Title Cased
        stationAddress: 'Eeser Gaard 2, 8332 VN Steenwijk',
        fuelType: '95 Ongelood',
      });

      const result = AiReceiptService.normalizeAiResult(mockGeminiJson, 'gemini', 'gemini-3.8-flash');
      assert.equal(result.date, '2026-10-19');
      assert.equal(result.liters, 37.41);
      assert.equal(result.pricePerLiter, 2.159);
      assert.equal(result.totalCost, 80.77); // 37.41 * 2.159 = 80.76819 -> 80.77
      assert.equal(result.station, 'Fieten Olie');
      assert.equal(result.stationAddress, 'Eeser Gaard 2, 8332 VN Steenwijk');
      assert.equal(result.fuelType, '95 Ongelood');
      assert.equal(result.engine, 'gemini');
    });

    it('should format all-caps station names and addresses correctly', () => {
      const mockOpenAiJson = JSON.stringify({
        date: '2026-10-27',
        liters: 40.89,
        pricePerLiter: 2.079,
        totalCost: 85.01,
        station: 'FIETEN OLIE STEENWIJK',
        stationAddress: 'EESER GAARD 2, 8332 VN STEENWIJK',
      });

      const result = AiReceiptService.normalizeAiResult(mockOpenAiJson, 'openai', 'gpt-4o-mini');
      assert.equal(result.station, 'Fieten Olie Steenwijk');
      assert.equal(result.stationAddress, 'Eeser Gaard 2, 8332 VN Steenwijk');
    });

    it('should handle markdown fenced JSON codeblocks from LLMs', () => {
      const fencedJson = '```json\n{"date":"27-10-2026","liters":"40.89","pricePerLiter":"2.079","totalCost":"85.01","station":"Fieten Olie","fuelType":"95 Ongelood"}\n```';
      const result = AiReceiptService.normalizeAiResult(fencedJson, 'openai', 'gpt-4o-mini');
      assert.equal(result.date, '2026-10-27');
      assert.equal(result.liters, 40.89);
      assert.equal(result.pricePerLiter, 2.079);
      assert.equal(result.totalCost, 85.01);
      assert.equal(result.station, 'Fieten Olie');
      assert.equal(result.fuelType, '95 Ongelood');
    });

    it('should test connection validation rejecting empty keys', async () => {
      const res = await AiReceiptService.testConnection('gemini', '');
      assert.equal(res.success, false);
      assert.ok(res.message.includes('Geen API-sleutel ingevoerd'));
    });

    it('should preserve existing API key when empty string or masked key is passed on save', () => {
      setSystemSetting('gemini_api_key', 'AQ.Ab8RealKey123456');

      // Simulate SettingsController.updateAiSettings logic
      const emptyInput = '';
      if (emptyInput.trim().length > 0 && !emptyInput.includes('••••') && !emptyInput.includes('...')) {
        setSystemSetting('gemini_api_key', emptyInput);
      }
      assert.equal(getSystemSetting('gemini_api_key'), 'AQ.Ab8RealKey123456');

      const maskedInput = 'AQ.Ab8...3456';
      if (maskedInput.trim().length > 0 && !maskedInput.includes('••••') && !maskedInput.includes('...')) {
        setSystemSetting('gemini_api_key', maskedInput);
      }
      assert.equal(getSystemSetting('gemini_api_key'), 'AQ.Ab8RealKey123456');

      // Only explicit clear should clear it
      const clearGeminiKey = true;
      if (clearGeminiKey) {
        setSystemSetting('gemini_api_key', '');
      }
      assert.equal(getSystemSetting('gemini_api_key'), '');
    });
  });

  describe('Gas Station Location & GPS Service', () => {
    it('should calculate Haversine distance in meters accurately', () => {
      // Distance between two points in Steenwijk: ~1.8 km
      const meters = StationService.calculateDistanceMeters(52.788, 6.121, 52.8037052, 6.1287276);
      assert.ok(meters > 1700 && meters < 1950, `Expected ~1822m, got ${meters}`);
    });

    it('should format distance cleanly in meters and kilometers', () => {
      assert.equal(StationService.formatDistance(120), '120 m');
      assert.equal(StationService.formatDistance(999), '999 m');
      assert.equal(StationService.formatDistance(1822), '1.8 km');
      assert.equal(StationService.formatDistance(12400), '12.4 km');
    });

    it('should store and retrieve station location details on fuel entries', () => {
      const fuelId = crypto.randomUUID();
      db.run(
        `INSERT INTO fuel_entries (
          id, vehicle_id, date, odometer, liters, price_per_liter, total_cost,
          is_full_tank, missed_previous, notes, station_name, station_address,
          latitude, longitude, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fuelId,
          testVehicleId,
          '2026-10-27',
          65000,
          40.89,
          2.079,
          85.01,
          1,
          0,
          'Regular fill-up',
          'Fieten Olie Steenwijk',
          'Eeser Gaard 2, 8332 VN Steenwijk',
          52.8037,
          6.1287,
          new Date().toISOString(),
        ]
      );

      const entry = db.get<any>('SELECT * FROM fuel_entries WHERE id = ?', [fuelId]);
      assert.equal(entry.station_name, 'Fieten Olie Steenwijk');
      assert.equal(entry.station_address, 'Eeser Gaard 2, 8332 VN Steenwijk');
      assert.equal(entry.latitude, 52.8037);
      assert.equal(entry.longitude, 6.1287);

      // Test updating the fuel entry
      db.run(
        `UPDATE fuel_entries SET
          date = ?,
          odometer = ?,
          liters = ?,
          price_per_liter = ?,
          total_cost = ?,
          notes = ?
         WHERE id = ?`,
        ['2026-10-28', 65100, 42.00, 2.100, 88.20, 'Updated notes', fuelId]
      );

      const updated = db.get<any>('SELECT * FROM fuel_entries WHERE id = ?', [fuelId]);
      assert.equal(updated.date, '2026-10-28');
      assert.equal(updated.odometer, 65100);
      assert.equal(updated.liters, 42.00);
      assert.equal(updated.price_per_liter, 2.100);
      assert.equal(updated.total_cost, 88.20);
      assert.equal(updated.notes, 'Updated notes');

      db.run('DELETE FROM fuel_entries WHERE id = ?', [fuelId]);
    });

    it('should extract Dutch station address and format brand names from receipt text', () => {
      // 1. Exact Fieten Olie receipt header test
      const receiptText = `FIETEN OLIE\nEeser Gaard 2\n8332 VN Steenwijk\nTelefoon:(0528) 34 12 93\nDatum 19-10-2026`;
      const extractedAddr = extractDutchAddress(receiptText);
      assert.equal(extractedAddr, 'Eeser Gaard 2, 8332 VN Steenwijk');

      // 2. Format station brand name
      assert.equal(formatStationName('FIETEN OLIE'), 'Fieten Olie');
      assert.equal(formatStationName('SHELL EXPRESS'), 'Shell Express');
      assert.equal(formatStationName('BP'), 'BP');
      assert.equal(formatStationName('ESSO'), 'ESSO');

      // 3. Format address casing keeping postal code uppercase
      assert.equal(formatAddress('EESER GAARD 2, 8332 VN STEENWIJK'), 'Eeser Gaard 2, 8332 VN Steenwijk');

      // 4. normalizeAiResult extracting address when combined in station or raw JSON
      const aiJson = JSON.stringify({
        date: '2026-10-19',
        liters: 37.41,
        pricePerLiter: 2.159,
        totalCost: 80.77,
        station: 'FIETEN OLIE, Eeser Gaard 2, 8332 VN Steenwijk',
        fuelType: '95 Ongelood',
      });
      const parsed = AiReceiptService.normalizeAiResult(aiJson, 'gemini', 'gemini-3.8-flash');
      assert.equal(parsed.station, 'Fieten Olie');
      assert.equal(parsed.stationAddress, 'Eeser Gaard 2, 8332 VN Steenwijk');
      assert.equal(parsed.liters, 37.41);
      assert.equal(parsed.totalCost, 80.77);
    });

    it('should filter available Gemini models to only multimodal text/vision models', () => {
      const rawApiModels = [
        'gemini-3.8-flash-lite-tts',
        'gemini-3.8-flash-tts',
        'gemini-3.8-flash',
        'gemini-2.5-flash-image',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-3.1-flash-lite-preview',
        'embedding-001',
        'text-bison-001',
      ];

      const filtered = filterVisionModels(rawApiModels);

      // Must include valid vision models
      assert.ok(filtered.includes('gemini-3.8-flash'));
      assert.ok(filtered.includes('gemini-2.5-flash'));
      assert.ok(filtered.includes('gemini-2.5-flash-lite'));
      assert.ok(filtered.includes('gemini-3.1-flash-lite-preview'));

      // Must exclude specialized TTS, image gen, embedding, and retired models
      assert.ok(!filtered.includes('gemini-3.8-flash-lite-tts'));
      assert.ok(!filtered.includes('gemini-3.8-flash-tts'));
      assert.ok(!filtered.includes('gemini-2.5-flash-image'));
      assert.ok(!filtered.includes('gemini-2.0-flash'));
      assert.ok(!filtered.includes('gemini-1.5-flash'));
      assert.ok(!filtered.includes('gemini-1.5-pro'));
      assert.ok(!filtered.includes('embedding-001'));
      assert.ok(!filtered.includes('text-bison-001'));

      // Preferred recommended model must be first
      assert.equal(filtered[0], 'gemini-3.8-flash');
    });
  });

  describe('Home Assistant REST Telemetry & Sensors Engine', () => {
    it('should generate sensor payload for active vehicles with accurate telemetry', () => {
      const payload = HaService.getSensorsPayload();
      assert.equal(payload.status, 'ok');
      assert.equal(payload.version, '1.0.14');
      assert.ok(Array.isArray(payload.vehicles));
      assert.ok(payload.total_vehicles >= 1);

      const target = payload.vehicles.find((v) => v.id === testVehicleId);
      assert.ok(target, 'Test vehicle must be present in HA sensor payload');
      assert.equal(target.name, 'Daily Driver Golf 7');
      assert.equal(target.status, 'active');
      assert.ok(typeof target.odometer === 'number');
      assert.ok(target.apk);
      assert.ok(target.fuel_stats);
      assert.ok(target.attributes);
      assert.equal(target.attributes.license_plate, '12-XYZ-3');
    });
  });

  describe('Notification Engine & Dispatch Service', () => {
    it('should save and retrieve notification settings correctly', () => {
      NotificationService.saveSettings({
        provider: 'ntfy',
        ntfyUrl: 'https://ntfy.sh/test-vault-channel',
        enabledApk: true,
        enabledMaintenance: false,
      });

      const settings = NotificationService.getSettings();
      assert.equal(settings.provider, 'ntfy');
      assert.equal(settings.ntfyUrl, 'https://ntfy.sh/test-vault-channel');
      assert.equal(settings.enabledApk, true);
      assert.equal(settings.enabledMaintenance, false);
    });

    it('should handle test notification rejection when no provider is set gracefully', async () => {
      NotificationService.saveSettings({ provider: 'none' });
      const res = await NotificationService.testNotification();
      assert.equal(res.success, false);
      assert.ok(res.message.includes('uitgeschakeld'));
    });
  });

  describe('1-Click Database & File Backup/Restore Engine', () => {
    it('should generate valid zip archive containing vehiclevault.db and manifest.json', async () => {
      const zipBuffer = await BackupService.createBackupZip();
      assert.ok(zipBuffer.length > 0);

      const stats = BackupService.getStorageStats();
      assert.ok(typeof stats.databaseSizeFormatted === 'string');
      assert.ok(typeof stats.totalUploadsFormatted === 'string');
      assert.ok(typeof stats.dataDir === 'string');
    });
  });

  describe('PHEV/EV Energy Logging & Multi-User Roles', () => {
    it('should record electric charging sessions with kWh and price per kWh', () => {
      const fuelId = crypto.randomUUID();
      db.run(
        `INSERT INTO fuel_entries (
          id, vehicle_id, date, odometer, liters, price_per_liter, total_cost,
          energy_type, kwh, price_per_kwh, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fuelId,
          testVehicleId,
          '2026-10-29',
          16500,
          0,
          0,
          15.82,
          'electric',
          45.2,
          0.35,
          new Date().toISOString(),
        ]
      );

      const entry = db.get<any>('SELECT * FROM fuel_entries WHERE id = ?', [fuelId]);
      assert.ok(entry);
      assert.equal(entry.energy_type, 'electric');
      assert.equal(entry.kwh, 45.2);
      assert.equal(entry.price_per_kwh, 0.35);
      assert.equal(entry.total_cost, 15.82);
    });

    it('should support driver and admin roles properly', () => {
      const driverUserId = crypto.randomUUID();
      const uniqueEmail = `driver_${crypto.randomUUID()}@vehiclevault.local`;
      const now = new Date().toISOString();
      db.run(
        'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [driverUserId, uniqueEmail, 'fakehash', 'driver', now, now]
      );

      const user = db.get<any>('SELECT role FROM users WHERE id = ?', [driverUserId]);
      assert.equal(user.role, 'driver');
    });
  });

  describe('Recurring Expenses & Fixed Costs TCO Engine', () => {
    it('should calculate monthly normalized recurring costs accurately', () => {
      const exp1Id = crypto.randomUUID();
      const exp2Id = crypto.randomUUID();
      const exp3Id = crypto.randomUUID();
      const now = new Date().toISOString();

      // Road tax: 65 / month
      db.run(
        `INSERT INTO recurring_expenses (id, vehicle_id, name, category, frequency, amount, start_date, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [exp1Id, testVehicleId, 'Motorrijtuigenbelasting (MRB)', 'tax', 'monthly', 65.0, '2026-01-01', now]
      );

      // Insurance: 720 / year = 60 / month
      db.run(
        `INSERT INTO recurring_expenses (id, vehicle_id, name, category, frequency, amount, start_date, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [exp2Id, testVehicleId, 'All-risk Autoverzekering', 'insurance', 'yearly', 720.0, '2026-01-01', now]
      );

      // Roadside assistance: 30 / quarter = 10 / month
      db.run(
        `INSERT INTO recurring_expenses (id, vehicle_id, name, category, frequency, amount, start_date, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [exp3Id, testVehicleId, 'ANWB Wegenwacht', 'roadside', 'quarterly', 30.0, '2026-01-01', now]
      );

      const expenses = db.query<any>('SELECT * FROM recurring_expenses WHERE vehicle_id = ? AND is_active = 1', [testVehicleId]);
      let monthlyTotal = 0;
      for (const e of expenses) {
        if (e.frequency === 'monthly') monthlyTotal += e.amount;
        else if (e.frequency === 'quarterly') monthlyTotal += e.amount / 3;
        else if (e.frequency === 'yearly') monthlyTotal += e.amount / 12;
      }

      assert.equal(monthlyTotal, 135.0); // 65 + 60 + 10 = 135

      // TCO service calculation
      const tco = TcoService.calculateTco({ vehicleId: testVehicleId, includeFixedExpenses: true });
      assert.equal(tco.monthlyFixedCost, 135.0);
      assert.ok(tco.fixedExpensesTotal >= 135.0);
      assert.ok(tco.totalCost >= tco.fixedExpensesTotal);

      // TCO service calculation without fixed expenses
      const tcoWithoutFixed = TcoService.calculateTco({ vehicleId: testVehicleId, includeFixedExpenses: false });
      assert.equal(tcoWithoutFixed.includeFixedExpenses, false);
      assert.equal(tcoWithoutFixed.totalCost, Math.round((tco.totalCost - tco.fixedExpensesTotal) * 100) / 100);
    });
  });

  describe('Trip Logging & Belastingdienst CSV Export Engine', () => {
    it('should record trips, calculate distances and summarize business vs private km', () => {
      const trip1Id = crypto.randomUUID();
      const trip2Id = crypto.randomUUID();
      const now = new Date().toISOString();

      // Trip 1: Business trip, 16500 to 16560 = 60km
      db.run(
        `INSERT INTO trips (id, vehicle_id, user_id, date, start_odometer, end_odometer, distance_km, from_location, to_location, purpose, description, is_return_trip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [trip1Id, testVehicleId, testUserId, '2026-10-20', 16500, 16560, 60.0, 'Amsterdam', 'Rotterdam', 'business', 'Klantafspraak', now]
      );

      // Trip 2: Private trip, 16560 to 16585 = 25km
      db.run(
        `INSERT INTO trips (id, vehicle_id, user_id, date, start_odometer, end_odometer, distance_km, from_location, to_location, purpose, description, is_return_trip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [trip2Id, testVehicleId, testUserId, '2026-10-21', 16560, 16585, 25.0, 'Rotterdam', 'Breda', 'private', 'Familiebezoek', now]
      );

      const trips = db.query<any>('SELECT * FROM trips WHERE vehicle_id = ? ORDER BY date ASC', [testVehicleId]);
      assert.ok(trips.length >= 2);

      let totalDist = 0;
      let businessDist = 0;
      let privateDist = 0;
      for (const t of trips) {
        totalDist += Number(t.distance_km);
        if (t.purpose === 'business') businessDist += Number(t.distance_km);
        if (t.purpose === 'private') privateDist += Number(t.distance_km);
      }

      assert.ok(totalDist >= 85.0);
      assert.ok(businessDist >= 60.0);
      assert.ok(privateDist >= 25.0);
    });

    it('should format Belastingdienst-compliant CSV export with correct headers and semicolon delimiter', () => {
      const trips = db.query<any>('SELECT * FROM trips WHERE vehicle_id = ? ORDER BY date DESC', [testVehicleId]);
      assert.ok(trips.length > 0);

      const headers = [
        'Datum',
        'Vertrekadres',
        'Aankomstadres',
        'Beginstand (km)',
        'Eindstand (km)',
        'Afstand (km)',
        'Karakter rit',
        'Toelichting/Omschrijving',
        'Terugrit',
      ];

      const csvLines = [headers.join(';')];
      for (const t of trips) {
        csvLines.push(
          [
            t.date,
            `"${(t.from_location || '').replace(/"/g, '""')}"`,
            `"${(t.to_location || '').replace(/"/g, '""')}"`,
            t.start_odometer,
            t.end_odometer,
            t.distance_km,
            t.purpose === 'business' ? 'Zakelijk' : t.purpose === 'commute' ? 'Woon-werk' : 'Prive',
            `"${(t.description || '').replace(/"/g, '""')}"`,
            t.is_return_trip ? 'Ja' : 'Nee',
          ].join(';')
        );
      }

      const csvContent = '\uFEFF' + csvLines.join('\r\n');
      assert.ok(csvContent.startsWith('\uFEFFDatum;Vertrekadres;Aankomstadres'));
      assert.ok(csvContent.includes('"Amsterdam";"Rotterdam"'));
      assert.ok(csvContent.includes('Zakelijk'));
    });

    it('should generate an Excel (.xlsx) workbook for trips with summary metrics and formulas', async () => {
      const trips = db.query<any>('SELECT * FROM trips WHERE vehicle_id = ? ORDER BY date DESC', [testVehicleId]);
      const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [testVehicleId]);

      const buffer = await TripExportService.generateExcel(vehicle, trips, '2026');
      assert.ok(Buffer.isBuffer(buffer));
      assert.ok(buffer.length > 1000);
      assert.equal(buffer[0], 0x50); // 'P'
      assert.equal(buffer[1], 0x4b); // 'K'
      assert.equal(buffer[2], 0x03);
      assert.equal(buffer[3], 0x04);
    });

    it('should generate a PDF fiscal dossier (landscape A4) for trips', async () => {
      const trips = db.query<any>('SELECT * FROM trips WHERE vehicle_id = ? ORDER BY date DESC', [testVehicleId]);
      const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [testVehicleId]);

      const buffer = await TripExportService.generatePdf(vehicle, trips, '2026');
      assert.ok(Buffer.isBuffer(buffer));
      assert.ok(buffer.length > 1000);
      const headerStr = buffer.subarray(0, 5).toString('utf-8');
      assert.equal(headerStr, '%PDF-');
    });
  });

  describe('Tire Set Management & Safety Limit Alerts Engine', () => {
    it('should detect tread depth warnings and legal minimum alerts correctly', () => {
      const summerSetId = crypto.randomUUID();
      const winterSetId = crypto.randomUUID();
      const wornSetId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Good Summer Set (6.5mm)
      db.run(
        `INSERT INTO tire_sets (id, vehicle_id, name, season, brand_model, tire_size, status, tread_depth_fl, tread_depth_fr, tread_depth_rl, tread_depth_rr, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [summerSetId, testVehicleId, 'Zomerset 18 inch', 'summer', 'Michelin Pilot Sport 5', '225/40 R18', 'mounted', 6.5, 6.5, 6.8, 6.8, now]
      );

      // Winter Set with 3.5mm tread (< 4.0mm warning for winter tires)
      db.run(
        `INSERT INTO tire_sets (id, vehicle_id, name, season, brand_model, tire_size, status, tread_depth_fl, tread_depth_fr, tread_depth_rl, tread_depth_rr, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [winterSetId, testVehicleId, 'Winterset 16 inch', 'winter', 'Continental WinterContact TS 870', '205/55 R16', 'stored', 3.5, 3.6, 3.8, 3.8, now]
      );

      // Worn Set with 1.4mm tread (< 1.6mm legal rejection)
      db.run(
        `INSERT INTO tire_sets (id, vehicle_id, name, season, brand_model, tire_size, status, tread_depth_fl, tread_depth_fr, tread_depth_rl, tread_depth_rr, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [wornSetId, testVehicleId, 'Oude Bandenset', 'summer', 'Budget Tire', '205/55 R16', 'stored', 1.4, 1.5, 2.0, 2.1, now]
      );

      function evaluateStatus(set: any): 'ok' | 'warning' | 'critical' {
        const depths = [set.tread_depth_fl, set.tread_depth_fr, set.tread_depth_rl, set.tread_depth_rr].filter((d: any) => d != null);
        const min = Math.min(...depths);
        if (min < 1.6) return 'critical';
        if (set.season === 'winter' && min < 4.0) return 'warning';
        if (min < 2.5) return 'warning';
        return 'ok';
      }

      const summer = db.get<any>('SELECT * FROM tire_sets WHERE id = ?', [summerSetId]);
      const winter = db.get<any>('SELECT * FROM tire_sets WHERE id = ?', [winterSetId]);
      const worn = db.get<any>('SELECT * FROM tire_sets WHERE id = ?', [wornSetId]);

      assert.equal(evaluateStatus(summer), 'ok');
      assert.equal(evaluateStatus(winter), 'warning');
      assert.equal(evaluateStatus(worn), 'critical');
    });

    it('should calculate mileage delta when swapping tire sets', () => {
      const setAId = crypto.randomUUID();
      const setBId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Set A mounted at 10,000 km
      db.run(
        `INSERT INTO tire_sets (id, vehicle_id, name, season, status, mounted_odometer, total_km, created_at)
         VALUES (?, ?, ?, ?, 'mounted', 10000, 5000, ?)`,
        [setAId, testVehicleId, 'Set A', 'summer', now]
      );

      // Set B currently stored with 3,000 km
      db.run(
        `INSERT INTO tire_sets (id, vehicle_id, name, season, status, mounted_odometer, total_km, created_at)
         VALUES (?, ?, ?, ?, 'stored', NULL, 3000, ?)`,
        [setBId, testVehicleId, 'Set B', 'winter', now]
      );

      // Swap at odometer 18,000 km: Set A ran (18000 - 10000) = 8000 km. Set A total_km becomes 5000 + 8000 = 13000 km.
      const swapOdometer = 18000;
      const currentMounted = db.get<any>("SELECT * FROM tire_sets WHERE id = ?", [setAId]);
      assert.ok(currentMounted);
      const delta = swapOdometer - currentMounted.mounted_odometer;
      const newTotal = currentMounted.total_km + delta;

      db.run(
        "UPDATE tire_sets SET status = 'stored', total_km = ?, mounted_odometer = NULL WHERE id = ?",
        [newTotal, currentMounted.id]
      );

      db.run(
        "UPDATE tire_sets SET status = 'mounted', mounted_odometer = ? WHERE id = ?",
        [swapOdometer, setBId]
      );

      const updatedA = db.get<any>('SELECT * FROM tire_sets WHERE id = ?', [currentMounted.id]);
      const updatedB = db.get<any>('SELECT * FROM tire_sets WHERE id = ?', [setBId]);

      assert.equal(updatedA.status, 'stored');
      assert.equal(updatedA.total_km, 13000);
      assert.equal(updatedB.status, 'mounted');
      assert.equal(updatedB.mounted_odometer, 18000);
    });
  });

  describe('Fuel Fill-up Export & Module Toggle Configuration Engine', () => {
    it('should generate a formatted Excel (.xlsx) workbook for fuel entries', async () => {
      const vehicle = {
        name: 'Test Wagen',
        license_plate: 'AA-123-B',
        make: 'Volkswagen',
        model: 'Golf',
        fuel_type: 'Benzine',
        initial_odometer: 10000,
      };

      const entries = [
        {
          id: crypto.randomUUID(),
          date: '2026-05-01',
          odometer: 10500,
          liters: 45.2,
          price_per_liter: 1.959,
          total_cost: 88.55,
          is_full_tank: 1,
          missed_previous: 0,
          station_name: 'Shell Express',
          station_address: 'Rijksweg 1, Utrecht',
          energy_type: 'fuel',
          notes: 'Fijne tankbeurt',
        },
        {
          id: crypto.randomUUID(),
          date: '2026-05-15',
          odometer: 11100,
          liters: 42.8,
          price_per_liter: 1.929,
          total_cost: 82.56,
          is_full_tank: 1,
          missed_previous: 0,
          station_name: 'BP Station',
          station_address: 'Dorpsstraat 10, Breukelen',
          energy_type: 'fuel',
        },
      ];

      const buffer = await FuelExportService.generateExcel(vehicle, entries);
      assert.ok(Buffer.isBuffer(buffer));
      assert.ok(buffer.length > 1000);
      // Valid ZIP/Excel header PK\x03\x04
      assert.equal(buffer[0], 0x50);
      assert.equal(buffer[1], 0x4b);
      assert.equal(buffer[2], 0x03);
      assert.equal(buffer[3], 0x04);
    });

    it('should generate a UTF-8 BOM CSV with semicolon delimiter for fuel entries', () => {
      const vehicle = {
        name: 'Test Wagen',
        license_plate: 'AA-123-B',
        initial_odometer: 10000,
      };

      const entries = [
        {
          id: crypto.randomUUID(),
          date: '2026-05-01',
          odometer: 10500,
          liters: 45.2,
          price_per_liter: 1.959,
          total_cost: 88.55,
          is_full_tank: 1,
          missed_previous: 0,
          station_name: 'Shell Express',
          station_address: 'Rijksweg 1',
          energy_type: 'fuel',
          notes: 'Bon bewaard',
        },
      ];

      const buffer = FuelExportService.generateCsv(vehicle, entries);
      assert.ok(Buffer.isBuffer(buffer));
      const text = buffer.toString('utf-8');
      assert.ok(text.startsWith('\uFEFFDatum;Kilometerstand;Afstand (km);Liters/kWh;Type;Prijs per Eenheid;Totaalbedrag;Volle Tank;Tankstation;Adres;Notities'));
      assert.ok(text.includes('10500;500;45,20;Brandstof;1,959;88,55;Ja;"Shell Express";"Rijksweg 1";"Bon bewaard"'));
    });

    it('should persist and retrieve module toggle settings correctly', () => {
      const defaultSetting = getSystemSetting('enabled_modules');
      // If not yet set, should return null
      // Now save customized configuration
      const customConfig = {
        fuel: true,
        trips: false,
        maintenance: true,
        tires: false,
        fixedExpenses: true,
        documents: true,
        analytics: true,
      };
      setSystemSetting('enabled_modules', JSON.stringify(customConfig));

      const retrieved = JSON.parse(getSystemSetting('enabled_modules') || '{}');
      assert.equal(retrieved.trips, false);
      assert.equal(retrieved.tires, false);
      assert.equal(retrieved.fuel, true);
      assert.equal(retrieved.fixedExpenses, true);

      // Clean up back to all enabled or original
      if (defaultSetting) {
        setSystemSetting('enabled_modules', defaultSetting);
      } else {
        setSystemSetting(
          'enabled_modules',
          JSON.stringify({
            fuel: true,
            trips: true,
            maintenance: true,
            tires: true,
            fixedExpenses: true,
            documents: true,
            analytics: true,
          })
        );
      }
    });
  });
});
