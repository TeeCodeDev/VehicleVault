import { Router } from 'express';
import { DocumentController } from '../controllers/documentController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadDocument } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

// Accept both 'file' and 'document' multipart field names
const documentUploadMiddleware = (req: any, res: any, next: any) => {
  uploadDocument.fields([
    { name: 'file', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ])(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    if (req.files) {
      if (req.files['file']?.[0]) req.file = req.files['file'][0];
      else if (req.files['document']?.[0]) req.file = req.files['document'][0];
    }
    next();
  });
};

router.get('/:vehicleId', DocumentController.list);
router.post('/:vehicleId', uploadLimiter, documentUploadMiddleware, DocumentController.upload);
router.put('/:id', DocumentController.update);
router.delete('/:id', DocumentController.delete);

export default router;
