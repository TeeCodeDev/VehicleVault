import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { VehicleController } from '../controllers/vehicleController.js';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { TcoService } from '../services/tcoService.js';
import { RdwService } from '../services/rdwService.js';

function createMockRes() {
  let statusCode = 200;
  let body: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      body = data;
      return res;
    },
  };
  return { res, getStatus: () => statusCode, getBody: () => body };
}

describe('Vehicle Sold Archiving & Fleet Category Filtering', () => {
  before(() => {
    initializeDatabase();
  });

  it('marks a vehicle as sold with date and price, preserves history, and clears sale fields when restored', async () => {
    const userId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, `sold_${crypto.randomUUID().slice(0, 8)}@test.local`, 'hash', 'user', now, now]
    );
    db.run(
      'INSERT INTO vehicles (id, user_id, name, type, status, license_plate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [vehicleId, userId, 'Golf GTI', 'car', 'active', 'AB-123-C', now, now]
    );

    const sellReq: any = {
      params: { id: vehicleId },
      user: { userId, role: 'user' },
      body: {
        status: 'sold',
        sold_date: '2025-06-15',
        sold_price: 18500,
      },
    };
    const sellMock = createMockRes();
    await VehicleController.update(sellReq, sellMock.res);

    assert.equal(sellMock.getStatus(), 200);
    assert.equal(sellMock.getBody().success, true);

    const soldRow = db.get<any>('SELECT status, sold_date, sold_price FROM vehicles WHERE id = ?', [vehicleId]);
    assert.equal(soldRow.status, 'sold');
    assert.equal(soldRow.sold_date, '2025-06-15');
    assert.equal(soldRow.sold_price, 18500);

    // Restore to active should clear sold_date & sold_price
    const restoreReq: any = {
      params: { id: vehicleId },
      user: { userId, role: 'user' },
      body: {
        status: 'active',
      },
    };
    const restoreMock = createMockRes();
    await VehicleController.update(restoreReq, restoreMock.res);

    assert.equal(restoreMock.getStatus(), 200);
    assert.equal(restoreMock.getBody().success, true);

    const restoredRow = db.get<any>('SELECT status, sold_date, sold_price FROM vehicles WHERE id = ?', [vehicleId]);
    assert.equal(restoredRow.status, 'active');
    assert.equal(restoredRow.sold_date, null);
    assert.equal(restoredRow.sold_price, null);
  });

  it('caps fixed expenses at sold_date month in TcoService.calculateTco', () => {
    const userId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, `tcosold_${crypto.randomUUID().slice(0, 8)}@test.local`, 'hash', 'user', now, now]
    );
    db.run(
      'INSERT INTO vehicles (id, user_id, name, type, status, sold_date, sold_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [vehicleId, userId, 'Sold Civic', 'car', 'sold', '2025-03-20', 9500, now, now]
    );
    db.run(
      'INSERT INTO recurring_expenses (id, vehicle_id, name, category, frequency, amount, start_date, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), vehicleId, 'Verzekering', 'insurance', 'monthly', 100, '2025-01-01', 1, now]
    );

    const tco = TcoService.calculateTco({ vehicleId });
    assert.ok(tco);
    // Jan, Feb, Mar 2025 = 3 months * 100 = 300
    assert.equal(tco.fixedExpensesTotal, 300);
  });

  it('excludes sold vehicles from fleet TCO and filters fleet TCO by vehicleType category', async () => {
    const userId = crypto.randomUUID();
    const carId = crypto.randomUUID();
    const motoId = crypto.randomUUID();
    const soldCarId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, `fleet_${crypto.randomUUID().slice(0, 8)}@test.local`, 'hash', 'user', now, now]
    );
    db.run(
      'INSERT INTO vehicles (id, user_id, name, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [carId, userId, 'Active Car', 'car', 'active', now, now]
    );
    db.run(
      'INSERT INTO vehicles (id, user_id, name, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [motoId, userId, 'Active Moto', 'motorcycle', 'active', now, now]
    );
    db.run(
      'INSERT INTO vehicles (id, user_id, name, type, status, sold_date, sold_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [soldCarId, userId, 'Sold Car', 'car', 'sold', '2025-02-01', 5000, now, now]
    );

    // Add fuel entries so each vehicle has distinct TCO
    db.run(
      'INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), carId, '2025-01-10', 10000, 40, 2, 80, 1, now]
    );
    db.run(
      'INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), motoId, '2025-01-12', 5000, 15, 2, 30, 1, now]
    );
    db.run(
      'INSERT INTO fuel_entries (id, vehicle_id, date, odometer, liters, price_per_liter, total_cost, is_full_tank, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), soldCarId, '2025-01-15', 20000, 50, 2, 100, 1, now]
    );

    // 1. All active vehicles (should exclude soldCarId)
    const allMock = createMockRes();
    await AnalyticsController.getFleetTco({ user: { userId }, query: {} } as any, allMock.res);
    assert.equal(allMock.getStatus(), 200);
    assert.equal(allMock.getBody().vehicleCount, 2);
    assert.equal(allMock.getBody().fleetTotalCost, 110);
    assert.deepEqual(allMock.getBody().availableTypes.sort(), ['car', 'motorcycle']);

    // 2. Filter by 'car' (should include only carId, still exclude soldCarId)
    const carMock = createMockRes();
    await AnalyticsController.getFleetTco(
      { user: { userId }, query: { vehicleType: 'car' } } as any,
      carMock.res
    );
    assert.equal(carMock.getStatus(), 200);
    assert.equal(carMock.getBody().vehicleCount, 1);
    assert.equal(carMock.getBody().fleetTotalCost, 80);
    assert.equal(carMock.getBody().vehicles[0].id, carId);

    // 3. Filter by 'motorcycle'
    const motoMock = createMockRes();
    await AnalyticsController.getFleetTco(
      { user: { userId }, query: { vehicleType: 'motorcycle' } } as any,
      motoMock.res
    );
    assert.equal(motoMock.getStatus(), 200);
    assert.equal(motoMock.getBody().vehicleCount, 1);
    assert.equal(motoMock.getBody().fleetTotalCost, 30);
    assert.equal(motoMock.getBody().vehicles[0].id, motoId);

    // 4. Explicit includeInactive=true includes soldCarId for comparison
    const compareMock = createMockRes();
    await AnalyticsController.getFleetTco(
      { user: { userId }, query: { includeInactive: 'true' } } as any,
      compareMock.res
    );
    assert.equal(compareMock.getStatus(), 200);
    assert.equal(compareMock.getBody().vehicleCount, 3);
    assert.equal(compareMock.getBody().fleetTotalCost, 210);
  });

  it('automatically takes public showcase offline when sold unless keep_showcase_open is true', async () => {
    const userId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const showcaseId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, `scsold_${crypto.randomUUID().slice(0, 8)}@test.local`, 'hash', 'user', now, now]
    );
    db.run(
      'INSERT INTO vehicles (id, user_id, name, type, status, license_plate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [vehicleId, userId, 'Showcase Car', 'car', 'active', 'SC-99-XX', now, now]
    );
    db.run(
      'INSERT INTO vehicle_showcases (id, vehicle_id, public_slug, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [showcaseId, vehicleId, `slug-${crypto.randomUUID().slice(0, 8)}`, 1, now, now]
    );

    // 1. Mark as sold with keep_showcase_open: true -> stays active
    const keepMock = createMockRes();
    await VehicleController.update(
      {
        params: { id: vehicleId },
        user: { userId, role: 'user' },
        body: { status: 'sold', sold_date: '2026-11-25', keep_showcase_open: true },
      } as any,
      keepMock.res
    );
    assert.equal(keepMock.getStatus(), 200);
    const afterKeep = db.get<any>('SELECT is_active FROM vehicle_showcases WHERE id = ?', [showcaseId]);
    assert.equal(afterKeep.is_active, 1);

    // 2. Mark as sold without keep_showcase_open -> automatically taken offline (is_active = 0)
    const offlineMock = createMockRes();
    await VehicleController.update(
      {
        params: { id: vehicleId },
        user: { userId, role: 'user' },
        body: { status: 'sold', sold_date: '2026-11-25' },
      } as any,
      offlineMock.res
    );
    assert.equal(offlineMock.getStatus(), 200);
    const afterOffline = db.get<any>('SELECT is_active FROM vehicle_showcases WHERE id = ?', [showcaseId]);
    assert.equal(afterOffline.is_active, 0);
  });

  it('detects open RDW recalls and parses extended RDW specifications', () => {
    const withRecall = JSON.stringify({
      merk: 'FORD',
      raw: {
        eerste_kleur: 'WIT',
        massa_ledig_voertuig: '1744',
        openstaande_terugroepactie_indicator: 'Ja',
      },
    });
    const withoutRecall = JSON.stringify({
      openstaande_terugroepactie_indicator: 'Nee',
      catalogusprijs: '40445',
    });

    assert.equal(RdwService.hasOpenRecall(withRecall), true);
    assert.equal(RdwService.hasOpenRecall(withoutRecall), false);
    assert.equal(RdwService.hasOpenRecall(null), false);

    const parsed = RdwService.parseRdwData(withRecall);
    assert.equal(parsed?.eerste_kleur, 'WIT');
    assert.equal(parsed?.massa_ledig_voertuig, '1744');
  });
});
