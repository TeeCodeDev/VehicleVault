import { Router } from 'express';
import { VehicleController } from '../controllers/vehicleController.js';
import { PhotoController } from '../controllers/photoController.js';
import { ShowcaseController } from '../controllers/showcaseController.js';
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

// Multi-Photo Gallery
router.get('/:id/photos', PhotoController.list);
router.post('/:id/photos', uploadLimiter, uploadVehicleImage.array('photos', 20), PhotoController.upload);
router.put('/:id/photos/:photoId', PhotoController.update);
router.delete('/:id/photos/:photoId', PhotoController.delete);

// Showcase / Sales Dossier
router.get('/:id/showcase', ShowcaseController.get);
router.put('/:id/showcase', ShowcaseController.update);
router.get('/:id/showcase/export-zip', ShowcaseController.exportZip);

// Vehicle Sharing
router.get('/:id/shares', VehicleController.getShares);
router.post('/:id/shares', VehicleController.addShare);
router.delete('/:id/shares/:userId', VehicleController.removeShare);

export default router;

