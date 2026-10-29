import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/settings', requireAuth, requireAdmin, NotificationController.getSettings);
router.put('/settings', requireAuth, requireAdmin, NotificationController.updateSettings);
router.post('/test', requireAuth, requireAdmin, NotificationController.testNotification);
router.post('/check', requireAuth, NotificationController.checkAlerts);

export default router;
