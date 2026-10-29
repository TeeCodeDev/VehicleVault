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
}
