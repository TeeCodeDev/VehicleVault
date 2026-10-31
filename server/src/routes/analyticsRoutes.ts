import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/fleet', AnalyticsController.getFleetTco);
router.get('/tco/:vehicleId', AnalyticsController.getTco);
router.post('/export-pdf', AnalyticsController.exportPdf);

export default router;

