import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeDatabase } from '../db/schema.js';
import { BackupService } from '../services/backupService.js';

describe('Scheduled Auto-Backup & Restore Points', () => {
  before(() => {
    initializeDatabase();
  });

  it('saves and loads auto-backup schedule config', () => {
    const saved = BackupService.saveAutoBackupConfig({
      enabled: true,
      intervalHours: 12,
      retention: 5,
    });
    assert.equal(saved.enabled, true);
    assert.equal(saved.intervalHours, 12);
    assert.equal(saved.retention, 5);

    const loaded = BackupService.getAutoBackupConfig();
    assert.equal(loaded.enabled, true);
    assert.equal(loaded.intervalHours, 12);
    assert.equal(loaded.retention, 5);

    // Disable again to leave clean state
    BackupService.saveAutoBackupConfig({ enabled: false, intervalHours: 24, retention: 7 });
  });

  it('rejects path traversal and invalid backup filenames', () => {
    assert.throws(() => BackupService.getStoredBackupPath('../secret.zip'));
    assert.throws(() => BackupService.getStoredBackupPath('sub/backup.zip'));
    assert.throws(() => BackupService.getStoredBackupPath('backup.txt'));
  });

  it('creates a stored backup, lists it, and deletes it cleanly', async () => {
    const created = await BackupService.createScheduledBackup();
    assert.ok(created.filename.startsWith('vehiclevault-auto-'));
    assert.ok(created.filename.endsWith('.zip'));
    assert.ok(created.sizeBytes > 0);

    const filePath = BackupService.getStoredBackupPath(created.filename);
    assert.equal(fs.existsSync(filePath), true);

    const listed = BackupService.listStoredBackups();
    assert.ok(listed.some((b) => b.filename === created.filename));

    BackupService.deleteStoredBackup(created.filename);
    assert.equal(fs.existsSync(filePath), false);
  });
});
