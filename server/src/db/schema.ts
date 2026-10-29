import crypto from 'node:crypto';
import { db } from './database.js';

function columnExists(table: string, column: string): boolean {
  try {
    const columns = db.query(`PRAGMA table_info(${table})`);
    return columns.some((c: any) => c.name === column);
  } catch {
    return false;
  }
}

export function initializeDatabase(): void {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Refresh tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. API Keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      prefix TEXT NOT NULL,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Vehicles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'car',
      license_plate TEXT,
      vin TEXT,
      year INTEGER,
      make TEXT,
      model TEXT,
      fuel_type TEXT,
      purchase_date TEXT,
      purchase_price REAL DEFAULT 0,
      initial_odometer REAL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      rdw_data TEXT,
      apk_expiration_date TEXT,
      image_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Safely migrate existing database tables if missing new columns
  if (!columnExists('vehicles', 'image_path')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN image_path TEXT;');
  }

  // Migrate legacy English preset names in existing database to Dutch
  const legacyTranslationMap: Record<string, string> = {
    'Engine Oil & Filter': 'Motorolie & Oliefilter',
    'Spark Plugs': 'Bougies',
    'Brake Fluid': 'Remvloeistof',
    'Tires (Front)': 'Banden (Voor)',
    'Tires (Rear)': 'Banden (Achter)',
    'Transmission Fluid': 'Transmissievloeistof',
    'Air / Cabin Filter': 'Lucht- & Interieurfilter',
    'Chain & Sprockets (Motorcycle)': 'Ketting & Tandwielen (Motor)',
    'General Inspection / Custom': 'Algemene Inspectie / Maatwerk',
  };

  for (const [en, nl] of Object.entries(legacyTranslationMap)) {
    try {
      const oldCat = db.get<any>('SELECT id FROM service_categories WHERE name = ?', [en]);
      const newCat = db.get<any>('SELECT id FROM service_categories WHERE name = ?', [nl]);
      if (oldCat && newCat) {
        db.run('UPDATE maintenance_intervals SET category_id = ? WHERE category_id = ?', [newCat.id, oldCat.id]);
        db.run('UPDATE service_records SET category_id = ? WHERE category_id = ?', [newCat.id, oldCat.id]);
        db.run('DELETE FROM service_categories WHERE id = ?', [oldCat.id]);
      } else if (oldCat && !newCat) {
        db.run('UPDATE service_categories SET name = ? WHERE id = ?', [nl, oldCat.id]);
      }
      db.run('UPDATE maintenance_intervals SET custom_name = ? WHERE custom_name = ?', [nl, en]);
    } catch {
      // ignore
    }
  }

  // 5. Fuel entries
  db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_entries (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      liters REAL NOT NULL,
      price_per_liter REAL NOT NULL,
      total_cost REAL NOT NULL,
      is_full_tank INTEGER NOT NULL DEFAULT 1,
      missed_previous INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      receipt_path TEXT,
      station_name TEXT,
      station_address TEXT,
      latitude REAL,
      longitude REAL,
      energy_type TEXT NOT NULL DEFAULT 'fuel',
      kwh REAL,
      price_per_kwh REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);

  if (!columnExists('fuel_entries', 'station_name')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN station_name TEXT;');
  }
  if (!columnExists('fuel_entries', 'station_address')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN station_address TEXT;');
  }
  if (!columnExists('fuel_entries', 'latitude')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN latitude REAL;');
  }
  if (!columnExists('fuel_entries', 'longitude')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN longitude REAL;');
  }
  if (!columnExists('fuel_entries', 'energy_type')) {
    db.exec("ALTER TABLE fuel_entries ADD COLUMN energy_type TEXT NOT NULL DEFAULT 'fuel';");
  }
  if (!columnExists('fuel_entries', 'kwh')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN kwh REAL;');
  }
  if (!columnExists('fuel_entries', 'price_per_kwh')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN price_per_kwh REAL;');
  }

  // 6. Service categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_preset INTEGER NOT NULL DEFAULT 1,
      default_distance_interval REAL,
      default_time_months INTEGER
    );
  `);

  // 7. Maintenance intervals
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_intervals (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      custom_name TEXT,
      interval_km REAL,
      interval_months INTEGER,
      last_service_date TEXT,
      last_service_odometer REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE
    );
  `);

  // 8. Service records
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_records (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      category_id TEXT,
      maintenance_interval_id TEXT,
      service_item TEXT NOT NULL,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      performing_party TEXT NOT NULL DEFAULT 'self',
      cost REAL NOT NULL DEFAULT 0,
      parts_cost REAL NOT NULL DEFAULT 0,
      labor_cost REAL NOT NULL DEFAULT 0,
      notes TEXT,
      invoice_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (maintenance_interval_id) REFERENCES maintenance_intervals(id) ON DELETE SET NULL
    );
  `);

  if (!columnExists('service_records', 'parts_cost')) {
    db.exec('ALTER TABLE service_records ADD COLUMN parts_cost REAL NOT NULL DEFAULT 0;');
  }
  if (!columnExists('service_records', 'labor_cost')) {
    db.exec('ALTER TABLE service_records ADD COLUMN labor_cost REAL NOT NULL DEFAULT 0;');
  }
  try {
    db.exec('UPDATE service_records SET parts_cost = cost WHERE parts_cost = 0 AND labor_cost = 0 AND cost > 0;');
  } catch {}

  // 9. Vehicle documents (Digitale Handschoenenkast)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_documents (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 10. System settings (AI providers, API keys, global configurations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 11. Recurring expenses (Vaste Lasten: Wegenbelasting, Verzekering, Abonnementen)
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      frequency TEXT NOT NULL DEFAULT 'monthly',
      amount REAL NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);

  // 12. Trips (Ritregistratie: Zakelijk, Woon-werk, Privé)
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_odometer REAL NOT NULL,
      end_odometer REAL NOT NULL,
      distance_km REAL NOT NULL,
      from_location TEXT NOT NULL,
      to_location TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'business',
      description TEXT,
      is_return_trip INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 13. Tire sets & tread depth (Bandenbeheer)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tire_sets (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      name TEXT NOT NULL,
      season TEXT NOT NULL DEFAULT 'summer',
      brand_model TEXT,
      tire_size TEXT,
      dot_code TEXT,
      storage_location TEXT,
      status TEXT NOT NULL DEFAULT 'mounted',
      mounted_odometer REAL,
      mounted_date TEXT,
      total_km REAL NOT NULL DEFAULT 0,
      tread_depth_fl REAL,
      tread_depth_fr REAL,
      tread_depth_rl REAL,
      tread_depth_rr REAL,
      last_measured_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);

  // Seed default presets
  seedPresets();
}

function seedPresets(): void {
  const presets = [
    { name: 'Motorolie & Oliefilter', km: 15000, months: 12 },
    { name: 'Bougies', km: 60000, months: 48 },
    { name: 'Remvloeistof', km: 40000, months: 24 },
    { name: 'Banden (Voor)', km: 40000, months: 48 },
    { name: 'Banden (Achter)', km: 40000, months: 48 },
    { name: 'Transmissievloeistof', km: 80000, months: 60 },
    { name: 'Lucht- & Interieurfilter', km: 20000, months: 12 },
    { name: 'Ketting & Tandwielen (Motor)', km: 25000, months: 24 },
    { name: 'Algemene Inspectie / Maatwerk', km: 15000, months: 12 },
  ];

  for (const preset of presets) {
    const existing = db.get('SELECT id FROM service_categories WHERE name = ?', [preset.name]);
    if (!existing) {
      db.run(
        `INSERT INTO service_categories (id, name, is_preset, default_distance_interval, default_time_months)
         VALUES (?, ?, 1, ?, ?)`,
        [crypto.randomUUID(), preset.name, preset.km, preset.months]
      );
    }
  }
}
