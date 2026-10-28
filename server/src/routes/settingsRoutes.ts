import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/ai', requireAuth, SettingsController.getAiSettings);
router.put('/ai', requireAuth, SettingsController.updateAiSettings);
router.post('/ai/test', requireAuth, SettingsController.testAiConnection);

export default router;
