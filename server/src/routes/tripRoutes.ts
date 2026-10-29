import { Router } from 'express';
import { TripController } from '../controllers/tripController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', TripController.list);
router.post('/', TripController.create);
router.get('/export/csv', TripController.exportCsv);
router.put('/:id', TripController.update);
router.delete('/:id', TripController.delete);

export default router;
