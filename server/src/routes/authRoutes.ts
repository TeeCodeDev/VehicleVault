import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { PasskeyController } from '../controllers/passkeyController.js';
import { TwoFactorController } from '../controllers/twoFactorController.js';
import { OidcController } from '../controllers/oidcController.js';
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

// Two-Factor Authentication (TOTP Authenticator & Backup Codes)
router.get('/2fa/status', requireAuth, TwoFactorController.status);
router.post('/2fa/setup', requireAuth, TwoFactorController.setup);
router.post('/2fa/enable', requireAuth, TwoFactorController.enable);
router.post('/2fa/disable', requireAuth, TwoFactorController.disable);
router.post('/2fa/backup-codes', requireAuth, TwoFactorController.regenerateBackupCodes);
router.post('/2fa/verify', authLimiter, TwoFactorController.verifyLogin);

// OpenID Connect (OIDC / SSO)
router.get('/oidc/config', OidcController.getConfig);
router.get('/oidc/login', OidcController.login);
router.get('/oidc/callback', OidcController.callback);
router.get('/oidc/settings', requireAuth, requireAdmin, OidcController.getAdminSettings);
router.post('/oidc/settings', requireAuth, requireAdmin, OidcController.updateAdminSettings);
router.post('/oidc/test', requireAuth, requireAdmin, OidcController.testConnection);

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
