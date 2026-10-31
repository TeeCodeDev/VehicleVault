import { Router } from 'express';
import { VignetteController } from '../controllers/vignetteController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/:vehicleId', VignetteController.list);
router.get('/', VignetteController.list);
router.post('/', VignetteController.create);
router.put('/:id', VignetteController.update);
router.delete('/:id', VignetteController.delete);

export default router;

