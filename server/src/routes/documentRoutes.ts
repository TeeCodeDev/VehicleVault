import { Router } from 'express';
import { DocumentController } from '../controllers/documentController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadDocument } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

router.get('/:vehicleId', DocumentController.list);
router.post('/:vehicleId', uploadLimiter, uploadDocument.single('file'), DocumentController.upload);
router.delete('/:id', DocumentController.delete);

export default router;

