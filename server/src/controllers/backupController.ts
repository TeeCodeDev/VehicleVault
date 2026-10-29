import { Request, Response } from 'express';
import { BackupService } from '../services/backupService.js';

export class BackupController {
  public static async exportBackup(_req: Request, res: Response): Promise<void> {
    try {
      const zipBuffer = await BackupService.createBackupZip();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `vehiclevault-backup-${dateStr}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Backup export error:', err);
      res.status(500).json({ error: err?.message || 'Fout bij genereren van backup' });
    }
  }

  public static async importBackup(req: Request, res: Response): Promise<void> {
    try {
      const file = (req as any).file;
      if (!file || !file.buffer) {
        res.status(400).json({ error: 'Geen backup (.zip) bestand geüpload' });
        return;
      }

      const result = await BackupService.restoreFromZip(file.buffer);
      res.json(result);
    } catch (err: any) {
      console.error('Backup import error:', err);
      res.status(500).json({ error: err?.message || 'Fout bij herstellen van backup' });
    }
  }

  public static getStorageStats(_req: Request, res: Response): void {
    try {
      const stats = BackupService.getStorageStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: 'Fout bij ophalen van opslagstatistieken' });
    }
  }
}
