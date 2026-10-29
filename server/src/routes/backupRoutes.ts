import { Router } from 'express';
import multer from 'multer';
import { BackupController } from '../controllers/backupController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 }, // Up to 250 MB backup zip
});

const router = Router();

router.get('/export', requireAuth, requireAdmin, BackupController.exportBackup);
router.post('/import', requireAuth, requireAdmin, upload.single('backup'), BackupController.importBackup);
router.get('/stats', requireAuth, requireAdmin, BackupController.getStorageStats);

export default router;

