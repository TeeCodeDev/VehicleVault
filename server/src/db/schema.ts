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
      last_login_at TEXT,
      last_active_at TEXT,
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
      plate_country TEXT NOT NULL DEFAULT 'NL',
      image_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Safely migrate existing database tables if missing new columns
  if (!columnExists('users', 'last_login_at')) {
    db.exec('ALTER TABLE users ADD COLUMN last_login_at TEXT;');
  }
  if (!columnExists('users', 'last_active_at')) {
    db.exec('ALTER TABLE users ADD COLUMN last_active_at TEXT;');
  }

  if (!columnExists('vehicles', 'image_path')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN image_path TEXT;');
  }
  if (!columnExists('vehicles', 'plate_country')) {
    db.exec("ALTER TABLE vehicles ADD COLUMN plate_country TEXT NOT NULL DEFAULT 'NL';");
  }

  // 4b. Multi-User Vehicle Sharing
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_shares (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at TEXT NOT NULL,
      UNIQUE(vehicle_id, user_id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_shares_user_id ON vehicle_shares (user_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_shares_vehicle_id ON vehicle_shares (vehicle_id);
  `);

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
      is_towing INTEGER NOT NULL DEFAULT 0,
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
  if (!columnExists('fuel_entries', 'is_towing')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN is_towing INTEGER NOT NULL DEFAULT 0;');
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
      maintenance_interval_ids TEXT,
      service_item TEXT NOT NULL,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      performing_party TEXT NOT NULL DEFAULT 'self',
      cost REAL NOT NULL DEFAULT 0,
      parts_cost REAL NOT NULL DEFAULT 0,
      labor_cost REAL NOT NULL DEFAULT 0,
      garage_name TEXT,
      garage_address TEXT,
      line_items TEXT,
      notes TEXT,
      invoice_path TEXT,
      exclude_from_tco INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (maintenance_interval_id) REFERENCES maintenance_intervals(id) ON DELETE SET NULL
    );
  `);

  if (!columnExists('service_records', 'maintenance_interval_ids')) {
    db.exec('ALTER TABLE service_records ADD COLUMN maintenance_interval_ids TEXT;');
  }
  if (!columnExists('service_records', 'parts_cost')) {
    db.exec('ALTER TABLE service_records ADD COLUMN parts_cost REAL NOT NULL DEFAULT 0;');
  }
  if (!columnExists('service_records', 'labor_cost')) {
    db.exec('ALTER TABLE service_records ADD COLUMN labor_cost REAL NOT NULL DEFAULT 0;');
  }
  if (!columnExists('service_records', 'garage_name')) {
    db.exec('ALTER TABLE service_records ADD COLUMN garage_name TEXT;');
  }
  if (!columnExists('service_records', 'garage_address')) {
    db.exec('ALTER TABLE service_records ADD COLUMN garage_address TEXT;');
  }
  if (!columnExists('service_records', 'line_items')) {
    db.exec('ALTER TABLE service_records ADD COLUMN line_items TEXT;');
  }
  if (!columnExists('service_records', 'exclude_from_tco')) {
    db.exec('ALTER TABLE service_records ADD COLUMN exclude_from_tco INTEGER NOT NULL DEFAULT 0;');
  }
  try {
    db.exec('UPDATE service_records SET parts_cost = cost WHERE parts_cost = 0 AND labor_cost = 0 AND cost > 0;');
    db.exec(
      "UPDATE service_records SET maintenance_interval_ids = json_array(maintenance_interval_id) WHERE maintenance_interval_id IS NOT NULL AND maintenance_interval_id != '' AND (maintenance_interval_ids IS NULL OR maintenance_interval_ids = '');"
    );
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
      expires_at TEXT,
      document_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  if (!columnExists('vehicle_documents', 'expires_at')) {
    db.exec('ALTER TABLE vehicle_documents ADD COLUMN expires_at TEXT;');
  }

  if (!columnExists('vehicle_documents', 'document_date')) {
    db.exec('ALTER TABLE vehicle_documents ADD COLUMN document_date TEXT;');
  }

  // Backfill document_date from service_records or document names
  try {
    db.exec(`
      UPDATE vehicle_documents
      SET document_date = (
        SELECT sr.date FROM service_records sr
        WHERE sr.invoice_path = vehicle_documents.file_path
        LIMIT 1
      )
      WHERE (document_date IS NULL OR document_date = '')
        AND EXISTS (
          SELECT 1 FROM service_records sr WHERE sr.invoice_path = vehicle_documents.file_path
        );
    `);

    const docsWithoutDate = db.query<any>(
      "SELECT id, name, created_at FROM vehicle_documents WHERE document_date IS NULL OR document_date = ''"
    );
    for (const d of docsWithoutDate) {
      let parsedDate: string | null = null;
      const dmyMatch = d.name ? d.name.match(/\b([0-3]?[0-9])[-/.]([0-1]?[0-9])[-/.]([12][0-9]{3})\b/) : null;
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        parsedDate = `${year}-${month}-${day}`;
      } else {
        const ymdMatch = d.name ? d.name.match(/\b([12][0-9]{3})[-/.]([0-1]?[0-9])[-/.]([0-3]?[0-9])\b/) : null;
        if (ymdMatch) {
          parsedDate = `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
        }
      }
      if (!parsedDate && d.created_at) {
        parsedDate = d.created_at.split('T')[0];
      }
      if (parsedDate) {
        db.run('UPDATE vehicle_documents SET document_date = ? WHERE id = ?', [parsedDate, d.id]);
      }
    }
  } catch (err) {
    console.warn('Document date backfill warning:', err);
  }

  // 9b. Odometer logs (Automated Home Assistant, OBD2, manual telemetric logs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS odometer_logs (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      odometer REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'home_assistant',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_odometer_logs_vehicle ON odometer_logs (vehicle_id);
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
      brand TEXT,
      model TEXT,
      tire_size TEXT,
      rim_size TEXT,
      speed_index TEXT,
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
      purchase_price REAL DEFAULT 0,
      purchase_date TEXT,
      invoice_file TEXT,
      invoice_document_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);

  // Safe migration for tire_sets new columns
  try {
    const tireCols = db.query<any>("PRAGMA table_info(tire_sets)").map((c) => c.name);
    if (!tireCols.includes('brand')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN brand TEXT");
    }
    if (!tireCols.includes('model')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN model TEXT");
    }
    if (!tireCols.includes('rim_size')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN rim_size TEXT");
    }
    if (!tireCols.includes('speed_index')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN speed_index TEXT");
    }
    if (!tireCols.includes('purchase_price')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN purchase_price REAL DEFAULT 0");
    }
    if (!tireCols.includes('purchase_date')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN purchase_date TEXT");
    }
    if (!tireCols.includes('invoice_file')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN invoice_file TEXT");
    }
    if (!tireCols.includes('invoice_document_id')) {
      db.run("ALTER TABLE tire_sets ADD COLUMN invoice_document_id TEXT");
    }
  } catch {
    // Non-fatal migration check
  }

  // 14. Vehicle multi-photo gallery
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_photos (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'exterieur',
      title TEXT,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id ON vehicle_photos (vehicle_id);
  `);

  // 15. Vehicle showcase / sales dossier
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_showcases (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL UNIQUE,
      public_slug TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      asking_price REAL,
      price_label TEXT NOT NULL DEFAULT 'Vraagprijs',
      title TEXT,
      subtitle TEXT,
      highlights TEXT,
      options_list TEXT,
      transparency_notes TEXT,
      contact_whatsapp TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      contact_location TEXT,
      show_maintenance_history INTEGER NOT NULL DEFAULT 1,
      show_tire_status INTEGER NOT NULL DEFAULT 1,
      show_rdw_specs INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_showcases_slug ON vehicle_showcases (public_slug);
  `);

  // 16. Password reset tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets (token_hash);
  `);

  // 17. Passkeys (WebAuthn), single-use challenges and recovery codes
  db.exec(`
    CREATE TABLE IF NOT EXISTS passkey_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      device_type TEXT,
      backed_up INTEGER NOT NULL DEFAULT 0,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user ON passkey_credentials (user_id);

    CREATE TABLE IF NOT EXISTS auth_challenges (
      challenge TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      user_id TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code_hash TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes (user_id);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
  `);

  // Auto-migrate legacy single vehicle image into vehicle_photos if missing
  try {
    const vehiclesWithImage = db.query<any>("SELECT id, image_path, created_at FROM vehicles WHERE image_path IS NOT NULL AND image_path != ''");
    for (const v of vehiclesWithImage) {
      const existing = db.get<any>('SELECT id FROM vehicle_photos WHERE vehicle_id = ? AND file_path = ?', [v.id, v.image_path]);
      if (!existing) {
        db.run(
          `INSERT INTO vehicle_photos (id, vehicle_id, file_path, category, title, sort_order, is_primary, created_at)
           VALUES (?, ?, ?, 'exterieur', 'Hoofdfoto', 0, 1, ?)`,
          [crypto.randomUUID(), v.id, v.image_path, v.created_at || new Date().toISOString()]
        );
      }
    }
  } catch {
    // Non-fatal migration check
  }

  // Auto-normalize any YYYY-MM-DD dates in vehicle_documents names to DD-MM-YYYY
  try {
    const docsWithIsoDate = db.query<{ id: string; name: string }>(
      "SELECT id, name FROM vehicle_documents WHERE name GLOB '*[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]*'"
    );
    for (const d of docsWithIsoDate) {
      const normalizedName = d.name.replace(
        /\b(\d{4})-(\d{2})-(\d{2})\b/g,
        '$3-$2-$1'
      );
      if (normalizedName !== d.name) {
        db.run('UPDATE vehicle_documents SET name = ? WHERE id = ?', [normalizedName, d.id]);
      }
    }
  } catch {
    // Non-fatal migration check
  }

  // Auto-backfill purchase_date from RDW datum_tenaamstelling if missing, and mark pre-ownership service_records as exclude_from_tco = 1
  try {
    const allVehicles = db.query<any>('SELECT id, purchase_date, initial_odometer, rdw_data FROM vehicles');
    for (const v of allVehicles) {
      let ownershipDate = v.purchase_date && String(v.purchase_date).trim() ? String(v.purchase_date).trim() : null;
      if (!ownershipDate && v.rdw_data) {
        try {
          const parsedRdw = typeof v.rdw_data === 'string' ? JSON.parse(v.rdw_data) : v.rdw_data;
          const rawTenaam = parsedRdw?.datum_tenaamstelling || parsedRdw?.raw?.datum_tenaamstelling;
          if (rawTenaam) {
            const s = String(rawTenaam).trim();
            if (/^\d{8}$/.test(s)) {
              ownershipDate = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
            } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
              ownershipDate = s.slice(0, 10);
            }
            if (ownershipDate) {
              db.run('UPDATE vehicles SET purchase_date = ? WHERE id = ? AND (purchase_date IS NULL OR purchase_date = "")', [
                ownershipDate,
                v.id,
              ]);
            }
          }
        } catch {}
      }

      if (ownershipDate) {
        db.run(
          'UPDATE service_records SET exclude_from_tco = 1 WHERE vehicle_id = ? AND date < ?',
          [v.id, ownershipDate]
        );
      }
      if (v.initial_odometer && Number(v.initial_odometer) > 0) {
        db.run(
          'UPDATE service_records SET exclude_from_tco = 1 WHERE vehicle_id = ? AND odometer > 0 AND odometer < ?',
          [v.id, Number(v.initial_odometer)]
        );
      }
    }
  } catch {
    // Non-fatal migration check
  }

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
