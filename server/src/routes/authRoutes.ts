import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { PasskeyController } from '../controllers/passkeyController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/status', AuthController.status);
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
router.get('/verify-reset-token', AuthController.verifyResetToken);
router.post('/reset-password', authLimiter, AuthController.resetPassword);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);

// Passkeys (WebAuthn) and recovery codes
router.post('/passkey/login/options', authLimiter, PasskeyController.loginOptions);
router.post('/passkey/login/verify', authLimiter, PasskeyController.loginVerify);
router.post('/recovery/redeem', authLimiter, PasskeyController.redeemRecoveryCode);
router.get('/passkeys', requireAuth, PasskeyController.list);
router.post('/passkeys/register/options', requireAuth, PasskeyController.registerOptions);
router.post('/passkeys/register/verify', requireAuth, PasskeyController.registerVerify);
router.post('/passkeys/recovery-codes', requireAuth, PasskeyController.regenerateRecoveryCodes);
router.patch('/passkeys/:id', requireAuth, PasskeyController.rename);
router.delete('/passkeys/:id', requireAuth, PasskeyController.remove);

router.get('/api-keys', requireAuth, AuthController.listApiKeys);
router.post('/api-keys', requireAuth, AuthController.createApiKey);
router.delete('/api-keys/:id', requireAuth, AuthController.deleteApiKey);

// User Management & Sharing
router.get('/users/shareable', requireAuth, AuthController.listShareableUsers);
router.get('/users', requireAuth, requireAdmin, AuthController.listUsers);
router.post('/users', requireAuth, requireAdmin, AuthController.createUser);
router.patch('/users/:id/role', requireAuth, requireAdmin, AuthController.updateUserRole);
router.delete('/users/:id', requireAuth, requireAdmin, AuthController.deleteUser);
router.post('/users/:id/reset-link', requireAuth, requireAdmin, AuthController.generateUserResetLink);

export default router;
