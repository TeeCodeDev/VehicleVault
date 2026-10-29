import { Router } from 'express';
import { TireController } from '../controllers/tireController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', TireController.list);
router.post('/', TireController.create);
router.post('/:id/swap', TireController.swap);
router.post('/:id/tread', TireController.updateTread);
router.put('/:id', TireController.update);
router.delete('/:id', TireController.delete);

export default router;

