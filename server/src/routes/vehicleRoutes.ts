import { Router } from 'express';
import { VehicleController } from '../controllers/vehicleController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadVehicleImage } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

router.get('/', VehicleController.list);
router.post('/', VehicleController.create);
router.get('/rdw/:plate', VehicleController.rdwLookup);
router.post('/rdw/sync-apk', VehicleController.syncApk);
router.get('/:id', VehicleController.getById);
router.put('/:id', VehicleController.update);
router.delete('/:id', VehicleController.delete);
router.post('/:id/image', uploadLimiter, uploadVehicleImage.single('image'), VehicleController.uploadImage);

export default router;

