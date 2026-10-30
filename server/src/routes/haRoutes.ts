import { Router } from 'express';
import { HaController } from '../controllers/haController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Endpoints for Home Assistant REST integration
router.get('/sensors', requireAuth, HaController.getSensors);
router.post('/odometer', requireAuth, HaController.updateOdometer);

export default router;

