import { Router } from 'express';
import { MaintenanceController } from '../controllers/maintenanceController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadInvoice } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

router.get('/categories', MaintenanceController.listCategories);
router.get('/alerts', MaintenanceController.getFleetAlerts);

router.get('/intervals/:vehicleId', MaintenanceController.listIntervals);
router.post('/intervals', MaintenanceController.createInterval);
router.put('/intervals/:id', MaintenanceController.updateInterval);
router.delete('/intervals/:id', MaintenanceController.deleteInterval);

router.get('/records/:vehicleId', MaintenanceController.listRecords);
router.post('/records', MaintenanceController.createRecord);
router.delete('/records/:id', MaintenanceController.deleteRecord);
router.post('/upload-invoice', uploadLimiter, uploadInvoice.single('invoice'), MaintenanceController.uploadInvoiceFile);
router.post('/records/:id/invoice', uploadLimiter, uploadInvoice.single('invoice'), MaintenanceController.attachInvoiceToRecord);

export default router;

