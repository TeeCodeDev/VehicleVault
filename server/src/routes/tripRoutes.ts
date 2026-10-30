import { Router } from 'express';
import { TripController } from '../controllers/tripController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadCsv } from '../middleware/upload.js';

const router = Router();

router.use(requireAuth);

router.get('/', TripController.list);
router.post('/import/preview', uploadCsv.single('file'), TripController.importPreview);
router.post('/import/execute', TripController.importExecute);
router.post('/', TripController.create);
router.get('/export/csv', TripController.exportCsv);
router.get('/export/excel', TripController.exportExcel);
router.get('/export/pdf', TripController.exportPdf);
router.put('/:id', TripController.update);
router.delete('/:id', TripController.delete);

export default router;

