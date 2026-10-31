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

// Microsoft 365: sign in with a device code (no app registration needed)
router.post('/mail/microsoft/signin', requireAuth, requireAdmin, NotificationController.microsoftSignInStart);
router.post('/mail/microsoft/signin/status', requireAuth, requireAdmin, NotificationController.microsoftSignInStatus);
router.post('/mail/microsoft/signin/cancel', requireAuth, requireAdmin, NotificationController.microsoftSignInCancel);
router.delete('/mail/microsoft', requireAuth, requireAdmin, NotificationController.microsoftRemove);

// Gmail: sign in with Google. The callback has no login of its own: the one-time state is its proof.
router.post('/mail/google/start', requireAuth, requireAdmin, NotificationController.googleStart);
router.get('/mail/google/callback', NotificationController.googleCallback);
router.delete('/mail/google', requireAuth, requireAdmin, NotificationController.googleRemove);
router.post('/check', requireAuth, NotificationController.checkAlerts);

export default router;

