import { Router } from 'express';
import { HaController } from '../controllers/haController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Endpoint for Home Assistant REST integration
router.get('/sensors', requireAuth, HaController.getSensors);

export default router;
