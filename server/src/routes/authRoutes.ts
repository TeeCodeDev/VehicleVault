import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/status', AuthController.status);
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);

router.get('/api-keys', requireAuth, AuthController.listApiKeys);
router.post('/api-keys', requireAuth, AuthController.createApiKey);
router.delete('/api-keys/:id', requireAuth, AuthController.deleteApiKey);

// User Management (Admin only)
router.get('/users', requireAuth, requireAdmin, AuthController.listUsers);
router.patch('/users/:id/role', requireAuth, requireAdmin, AuthController.updateUserRole);
router.delete('/users/:id', requireAuth, requireAdmin, AuthController.deleteUser);

export default router;
