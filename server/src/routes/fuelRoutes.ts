import { Router } from 'express';
import { FuelController } from '../controllers/fuelController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadReceipt } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

router.get('/', FuelController.list);
router.post('/', FuelController.create);
router.delete('/:id', FuelController.delete);
router.post('/ocr', uploadLimiter, uploadReceipt.single('receipt'), FuelController.ocrReceipt);

export default router;

