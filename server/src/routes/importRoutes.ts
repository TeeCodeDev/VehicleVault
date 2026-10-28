import { Router } from 'express';
import { ImportController } from '../controllers/importController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadCsv } from '../middleware/upload.js';

const router = Router();

router.use(requireAuth);

router.post('/preview', uploadCsv.single('file'), ImportController.preview);
router.post('/execute', ImportController.execute);

export default router;

