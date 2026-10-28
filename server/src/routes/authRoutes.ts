import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);

router.get('/api-keys', requireAuth, AuthController.listApiKeys);
router.post('/api-keys', requireAuth, AuthController.createApiKey);
router.delete('/api-keys/:id', requireAuth, AuthController.deleteApiKey);

export default router;

