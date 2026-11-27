import path from 'node:path';
import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { db } from '../db/database.js';
import { DATA_PATHS, env } from '../config/env.js';
import { initializeDatabase } from '../db/schema.js';

export class BackupService {
  public static async createBackupZip(): Promise<Buffer> {
    // 1. Force SQLite WAL checkpoint to flush all data into the main database file
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (err) {
      console.warn('WAL checkpoint warning during backup:', err);
    }

    const zip = new AdmZip();

    // 2. Add manifest
    const manifest = {
      app: 'VehicleVault',
      version: '1.0.14',
      createdAt: new Date().toISOString(),
      platform: process.platform,
    };
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));

    // 3. Add SQLite Database file
    if (fs.existsSync(DATA_PATHS.db)) {
      zip.addLocalFile(DATA_PATHS.db, '', 'vehiclevault.db');
    }

    // 4. Add persistent upload directories if they exist
    const uploadDirs = [
      { localPath: DATA_PATHS.receipts, zipPath: 'receipts' },
      { localPath: DATA_PATHS.invoices, zipPath: 'invoices' },
      { localPath: DATA_PATHS.vehicles, zipPath: 'vehicles' },
      { localPath: DATA_PATHS.documents, zipPath: 'documents' },
    ];

    for (const dir of uploadDirs) {
      if (fs.existsSync(dir.localPath)) {
        const files = fs.readdirSync(dir.localPath);
        for (const file of files) {
          const filePath = path.join(dir.localPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            zip.addLocalFile(filePath, dir.zipPath);
          }
        }
      }
    }

    return zip.toBuffer();
  }

  public static async restoreFromZip(zipBuffer: Buffer): Promise<{ success: boolean; message: string }> {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    // 1. Validate that the zip contains vehiclevault.db or manifest.json
    const hasDb = zipEntries.some((e) => e.entryName === 'vehiclevault.db' || e.entryName.endsWith('/vehiclevault.db'));
    if (!hasDb) {
      throw new Error('Ongeldig backupbestand: vehiclevault.db ontbreekt in het ZIP-archief.');
    }

    // 2. Safely create a backup of current database
    if (fs.existsSync(DATA_PATHS.db)) {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        fs.copyFileSync(DATA_PATHS.db, `${DATA_PATHS.db}.bak`);
      } catch (err) {
        console.warn('Failed to create pre-restore backup copy:', err);
      }
    }

    // 3. Extract database and assets into DATA_DIR
    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const entryName = entry.entryName.replace(/\\/g, '/');

      if (entryName === 'vehiclevault.db') {
        fs.writeFileSync(DATA_PATHS.db, entry.getData());
      } else if (entryName.startsWith('receipts/')) {
        const fileName = path.basename(entryName);
        fs.writeFileSync(path.join(DATA_PATHS.receipts, fileName), entry.getData());
      } else if (entryName.startsWith('invoices/')) {
        const fileName = path.basename(entryName);
        fs.writeFileSync(path.join(DATA_PATHS.invoices, fileName), entry.getData());
      } else if (entryName.startsWith('vehicles/')) {
        const fileName = path.basename(entryName);
        fs.writeFileSync(path.join(DATA_PATHS.vehicles, fileName), entry.getData());
      } else if (entryName.startsWith('documents/')) {
        const fileName = path.basename(entryName);
        fs.writeFileSync(path.join(DATA_PATHS.documents, fileName), entry.getData());
      }
    }

    // 4. Synchronize database schema & verify integrity
    initializeDatabase();

    return {
      success: true,
      message: 'Backup succesvol hersteld! Alle voertuigen, tankbeurten en bestanden zijn gesynchroniseerd.',
    };
  }

  public static getStorageStats(): {
    databaseSizeFormatted: string;
    totalUploadsFormatted: string;
    dataDir: string;
  } {
    let dbSize = 0;
    if (fs.existsSync(DATA_PATHS.db)) {
      dbSize = fs.statSync(DATA_PATHS.db).size;
    }

    let uploadsSize = 0;
    const dirs = [DATA_PATHS.receipts, DATA_PATHS.invoices, DATA_PATHS.vehicles, DATA_PATHS.documents];
    for (const d of dirs) {
      if (fs.existsSync(d)) {
        const files = fs.readdirSync(d);
        for (const f of files) {
          const fp = path.join(d, f);
          try {
            uploadsSize += fs.statSync(fp).size;
          } catch {}
        }
      }
    }

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    return {
      databaseSizeFormatted: formatBytes(dbSize),
      totalUploadsFormatted: formatBytes(uploadsSize),
      dataDir: env.DATA_DIR,
    };
  }

  public static getBackupDir(): string {
    const dir = path.join(env.DATA_DIR, 'backups');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getAutoBackupConfig(): {
    enabled: boolean;
    intervalHours: number;
    retention: number;
    lastRunAt: string | null;
  } {
    const getSetting = (key: string): string | null => {
      const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
      return row ? row.value : null;
    };
    const enabled = getSetting('auto_backup_enabled') === 'true';
    const intervalHours = Math.max(1, Number(getSetting('auto_backup_interval_hours') || 24) || 24);
    const retention = Math.max(1, Math.min(90, Number(getSetting('auto_backup_retention') || 7) || 7));
    const lastRunAt = getSetting('auto_backup_last_run');
    return { enabled, intervalHours, retention, lastRunAt };
  }

  public static saveAutoBackupConfig(input: {
    enabled: boolean;
    intervalHours: number;
    retention: number;
  }): { enabled: boolean; intervalHours: number; retention: number; lastRunAt: string | null } {
    const now = new Date().toISOString();
    const intervalHours = Math.max(1, Math.min(720, Math.round(Number(input.intervalHours) || 24)));
    const retention = Math.max(1, Math.min(90, Math.round(Number(input.retention) || 7)));

    const upsert = (key: string, value: string) => {
      db.run('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, value, now]);
    };

    upsert('auto_backup_enabled', input.enabled ? 'true' : 'false');
    upsert('auto_backup_interval_hours', String(intervalHours));
    upsert('auto_backup_retention', String(retention));
    return this.getAutoBackupConfig();
  }

  public static getStoredBackupPath(filename: string): string {
    if (!/^[a-zA-Z0-9._-]+\.zip$/.test(filename)) {
      throw new Error('Ongeldige bestandsnaam voor backup.');
    }
    const backupDir = path.resolve(this.getBackupDir());
    const targetPath = path.resolve(backupDir, filename);
    if (path.dirname(targetPath) !== backupDir) {
      throw new Error('Ongeldig backup-pad.');
    }
    return targetPath;
  }

  public static listStoredBackups(): Array<{
    filename: string;
    sizeBytes: number;
    sizeFormatted: string;
    createdAt: string;
  }> {
    const dir = this.getBackupDir();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.zip'));
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    return files
      .map((filename) => {
        const stat = fs.statSync(path.join(dir, filename));
        return {
          filename,
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public static async createScheduledBackup(): Promise<{ filename: string; sizeBytes: number; createdAt: string }> {
    const zipBuffer = await this.createBackupZip();
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `vehiclevault-auto-${stamp}.zip`;
    const filePath = this.getStoredBackupPath(filename);
    fs.writeFileSync(filePath, zipBuffer);

    const nowIso = now.toISOString();
    db.run('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      'auto_backup_last_run',
      nowIso,
      nowIso,
    ]);

    const { retention } = this.getAutoBackupConfig();
    const stored = this.listStoredBackups().filter((b) => b.filename.startsWith('vehiclevault-auto-'));
    for (const old of stored.slice(retention)) {
      try {
        fs.unlinkSync(this.getStoredBackupPath(old.filename));
      } catch {}
    }

    return { filename, sizeBytes: zipBuffer.length, createdAt: nowIso };
  }

  public static async runScheduledBackupIfDue(): Promise<boolean> {
    const config = this.getAutoBackupConfig();
    if (!config.enabled) return false;

    if (config.lastRunAt) {
      const elapsedMs = Date.now() - new Date(config.lastRunAt).getTime();
      if (elapsedMs < config.intervalHours * 60 * 60 * 1000) {
        return false;
      }
    }

    await this.createScheduledBackup();
    return true;
  }

  public static async restoreStoredBackup(filename: string): Promise<{ success: boolean; message: string }> {
    const filePath = this.getStoredBackupPath(filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('Backupbestand niet gevonden op de server.');
    }
    const zipBuffer = fs.readFileSync(filePath);
    return this.restoreFromZip(zipBuffer);
  }

  public static deleteStoredBackup(filename: string): void {
    const filePath = this.getStoredBackupPath(filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('Backupbestand niet gevonden op de server.');
    }
    fs.unlinkSync(filePath);
  }
}

