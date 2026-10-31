import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/settings', requireAuth, requireAdmin, NotificationController.getSettings);
router.put('/settings', requireAuth, requireAdmin, NotificationController.updateSettings);
router.post('/test', requireAuth, requireAdmin, NotificationController.testNotification);
router.post('/test-smtp', requireAuth, requireAdmin, NotificationController.testSmtp);
router.get('/mail', requireAuth, requireAdmin, NotificationController.getMail);
router.put('/mail', requireAuth, requireAdmin, NotificationController.updateMail);
router.post('/mail/verify', requireAuth, requireAdmin, NotificationController.verifyMail);
router.post('/mail/test', requireAuth, requireAdmin, NotificationController.testSmtp);
router.post('/check', requireAuth, NotificationController.checkAlerts);

export default router;

