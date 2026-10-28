import { Router } from 'express';
import { FuelController } from '../controllers/fuelController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadReceipt } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

router.get('/stations/nearby', FuelController.getNearbyStations);
router.get('/stations/search', FuelController.searchStations);

router.get('/', FuelController.list);
router.get('/:vehicleId', FuelController.list);
router.post('/', FuelController.create);
router.delete('/:id', FuelController.delete);
router.post('/upload-receipt', uploadLimiter, uploadReceipt.single('receipt'), FuelController.uploadReceiptFile);
router.post('/ocr', uploadLimiter, uploadReceipt.single('receipt'), FuelController.ocrReceipt);

export default router;
