import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/settings', requireAuth, requireAdmin, NotificationController.getSettings);
router.put('/settings', requireAuth, requireAdmin, NotificationController.updateSettings);
router.post('/test', requireAuth, requireAdmin, NotificationController.testNotification);
router.post('/test-smtp', requireAuth, requireAdmin, NotificationController.testSmtp);
router.post('/check', requireAuth, NotificationController.checkAlerts);

// Web Push: every signed-in user manages their own devices; the VAPID private key never leaves the server.
router.get('/push/public-key', requireAuth, NotificationController.getPushPublicKey);
router.get('/push/status', requireAuth, NotificationController.getPushStatus);
router.post('/push/subscribe', requireAuth, NotificationController.pushSubscribe);
router.post('/push/unsubscribe', requireAuth, NotificationController.pushUnsubscribe);
router.post('/push/test', requireAuth, NotificationController.pushTest);

export default router;

