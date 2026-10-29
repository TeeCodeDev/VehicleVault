import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/ai', requireAuth, SettingsController.getAiSettings);
router.get('/ai/gemini-models', requireAuth, SettingsController.getGeminiModels);
router.put('/ai', requireAuth, SettingsController.updateAiSettings);
router.post('/ai/test', requireAuth, SettingsController.testAiConnection);

router.get('/security', requireAuth, SettingsController.getSecuritySettings);
router.put('/security', requireAuth, SettingsController.updateSecuritySettings);

router.get('/modules', requireAuth, SettingsController.getModuleSettings);
router.put('/modules', requireAuth, SettingsController.updateModuleSettings);

export default router;

