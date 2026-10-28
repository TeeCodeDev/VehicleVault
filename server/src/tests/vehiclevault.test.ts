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
});
