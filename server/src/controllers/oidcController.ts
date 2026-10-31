import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/token.js';
import { startSession } from '../utils/session.js';

interface OidcResolvedConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  buttonLabel: string;
}

function getSetting(key: string, defaultVal = ''): string {
  const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
  return row ? row.value : defaultVal;
}

function setSetting(key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', [
    key,
    value,
    new Date().toISOString(),
  ]);
}

export class OidcController {
  public static getResolvedConfig(req?: Request): OidcResolvedConfig {
    const envEnabled = (process.env.OIDC_ENABLED || '').toLowerCase() === 'true';
    const dbEnabled = getSetting('oidc_enabled') === 'true';
    const enabled = envEnabled || dbEnabled;

    const issuer = process.env.OIDC_ISSUER || getSetting('oidc_issuer', '');
    const clientId = process.env.OIDC_CLIENT_ID || getSetting('oidc_client_id', '');
    const clientSecret = process.env.OIDC_CLIENT_SECRET || getSetting('oidc_client_secret', '');
    const scopes = process.env.OIDC_SCOPES || getSetting('oidc_scopes', 'openid profile email');
    const buttonLabel =
      process.env.OIDC_BUTTON_LABEL ||
      getSetting('oidc_button_label', 'Inloggen met Single Sign-On (SSO / OIDC)');

    let redirectUri = process.env.OIDC_REDIRECT_URI || getSetting('oidc_redirect_uri', '');
    if (!redirectUri && req) {
      const host = req.get('x-forwarded-host') || req.get('host');
      const proto = req.get('x-forwarded-proto') || req.protocol;
      if (host) {
        redirectUri = `${proto}://${host}/api/auth/oidc/callback`;
      }
    }

    return {
      enabled,
      issuer: issuer.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim(),
      scopes: scopes.trim(),
      buttonLabel: buttonLabel.trim(),
    };
  }

  /**
   * Public config endpoint for frontend login button
   */
  public static async getConfig(req: Request, res: Response): Promise<void> {
    const cfg = OidcController.getResolvedConfig(req);
    res.json({
      enabled: cfg.enabled && Boolean(cfg.issuer && cfg.clientId),
      buttonLabel: cfg.buttonLabel,
    });
  }

  /**
   * Admin: Get full OIDC settings (without raw secret)
   */
  public static async getAdminSettings(req: Request, res: Response): Promise<void> {
    const cfg = OidcController.getResolvedConfig(req);
    res.json({
      enabled: cfg.enabled,
      issuer: cfg.issuer,
      clientId: cfg.clientId,
      clientSecretConfigured: Boolean(cfg.clientSecret),
      redirectUri: cfg.redirectUri,
      scopes: cfg.scopes,
      buttonLabel: cfg.buttonLabel,
    });
  }

  /**
   * Admin: Update OIDC settings
   */
  public static async updateAdminSettings(req: Request, res: Response): Promise<void> {
    const { enabled, issuer, clientId, clientSecret, redirectUri, scopes, buttonLabel } = req.body;

    if (enabled !== undefined) setSetting('oidc_enabled', enabled ? 'true' : 'false');
    if (issuer !== undefined) setSetting('oidc_issuer', String(issuer).trim());
    if (clientId !== undefined) setSetting('oidc_client_id', String(clientId).trim());
    if (clientSecret !== undefined && String(clientSecret).trim() !== '' && !String(clientSecret).includes('•••')) {
      setSetting('oidc_client_secret', String(clientSecret).trim());
    }
    if (redirectUri !== undefined) setSetting('oidc_redirect_uri', String(redirectUri).trim());
    if (scopes !== undefined) setSetting('oidc_scopes', String(scopes).trim());
    if (buttonLabel !== undefined) setSetting('oidc_button_label', String(buttonLabel).trim());

    res.json({ success: true, message: 'OIDC instellingen succesvol opgeslagen' });
  }

  /**
   * Initiate OIDC Login with PKCE
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const cfg = OidcController.getResolvedConfig(req);
      if (!cfg.enabled || !cfg.issuer || !cfg.clientId) {
        res.redirect('/login?error=oidc_not_configured');
        return;
      }

      // Fetch discovery document
      const discoveryUrl = `${cfg.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const discRes = await fetch(discoveryUrl, { signal: AbortSignal.timeout(6000) });
      if (!discRes.ok) {
        console.error('OIDC discovery failed:', discRes.status, discRes.statusText);
        res.redirect('/login?error=oidc_discovery_failed');
        return;
      }
      const disc = (await discRes.json()) as any;
      const authorizationEndpoint = disc.authorization_endpoint;
      if (!authorizationEndpoint) {
        res.redirect('/login?error=oidc_missing_authorization_endpoint');
        return;
      }

      // Generate state, nonce, and PKCE code_verifier
      const state = crypto.randomBytes(24).toString('hex');
      const nonce = crypto.randomBytes(24).toString('hex');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

      const cookiePayload = JSON.stringify({ state, codeVerifier, nonce, createdAt: Date.now() });
      res.cookie('vv_oidc_state', cookiePayload, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.get('x-forwarded-proto') === 'https',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        scope: cfg.scopes || 'openid profile email',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const authUrl = `${authorizationEndpoint}${authorizationEndpoint.includes('?') ? '&' : '?'}${params.toString()}`;
      res.redirect(authUrl);
    } catch (err: any) {
      console.error('OIDC login error:', err);
      res.redirect(`/login?error=${encodeURIComponent(err?.message || 'oidc_error')}`);
    }
  }

  /**
   * OIDC Callback: exchange code, resolve profile, create/login user
   */
  public static async callback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error('OIDC IdP returned error:', error, error_description);
        res.redirect(`/login?error=${encodeURIComponent(String(error_description || error))}`);
        return;
      }

      if (!code || !state) {
        res.redirect('/login?error=oidc_missing_code_or_state');
        return;
      }

      const rawCookie = req.cookies?.vv_oidc_state;
      if (!rawCookie) {
        res.redirect('/login?error=oidc_session_expired');
        return;
      }

      let stateData: { state: string; codeVerifier: string; nonce: string; createdAt: number };
      try {
        stateData = JSON.parse(rawCookie);
      } catch {
        res.redirect('/login?error=oidc_invalid_state');
        return;
      }

      if (stateData.state !== state || Date.now() - stateData.createdAt > 15 * 60 * 1000) {
        res.redirect('/login?error=oidc_state_mismatch');
        return;
      }

      const cfg = OidcController.getResolvedConfig(req);
      const discoveryUrl = `${cfg.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const discRes = await fetch(discoveryUrl, { signal: AbortSignal.timeout(6000) });
      const disc = (await discRes.json()) as any;

      const tokenEndpoint = disc.token_endpoint;
      const userinfoEndpoint = disc.userinfo_endpoint;

      // Exchange code for tokens
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: cfg.redirectUri,
        client_id: cfg.clientId,
        code_verifier: stateData.codeVerifier,
      });

      if (cfg.clientSecret) {
        tokenBody.append('client_secret', cfg.clientSecret);
      }

      const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('OIDC token exchange failed:', tokenRes.status, errText);
        res.redirect('/login?error=oidc_token_exchange_failed');
        return;
      }

      const tokenData = (await tokenRes.json()) as any;
      const accessToken = tokenData.access_token;

      // Fetch user profile from userinfo endpoint
      let profile: any = {};
      if (userinfoEndpoint && accessToken) {
        const uRes = await fetch(userinfoEndpoint, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        if (uRes.ok) {
          profile = await uRes.json();
        }
      }

      // If id_token exists, we can also extract claims
      if (tokenData.id_token) {
        try {
          const parts = tokenData.id_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            profile = { ...payload, ...profile };
          }
        } catch {}
      }

      const email = (
        profile.email ||
        profile.preferred_username ||
        profile.upn ||
        profile.sub ||
        ''
      )
        .toString()
        .trim()
        .toLowerCase();

      const sub = (profile.sub || '').toString().trim();

      if (!email && !sub) {
        res.redirect('/login?error=oidc_no_identity_returned');
        return;
      }

      const userEmail = email.includes('@') ? email : `${email || sub}@sso.local`;

      // Match user in database
      let user = db.get<any>(
        'SELECT * FROM users WHERE oidc_id = ? OR email = ?',
        [sub || userEmail, userEmail]
      );

      const now = new Date().toISOString();

      if (!user) {
        // First user is admin, else regular user
        const userCount = db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
        const role = (userCount?.count || 0) === 0 ? 'admin' : 'user';
        const userId = crypto.randomUUID();
        const placeholderPasswordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

        db.run(
          `INSERT INTO users (id, email, password_hash, role, oidc_id, oidc_provider, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'oidc', ?, ?)`,
          [userId, userEmail, placeholderPasswordHash, role, sub || userEmail, now, now]
        );

        user = db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
      } else if (!user.oidc_id && sub) {
        db.run('UPDATE users SET oidc_id = ?, oidc_provider = "oidc", updated_at = ? WHERE id = ?', [
          sub,
          now,
          user.id,
        ]);
      }

      // Start session and clear state cookie
      res.clearCookie('vv_oidc_state');
      startSession(req, res, user, { trackLogin: true });

      res.redirect('/?sso=success');
    } catch (err: any) {
      console.error('OIDC callback processing error:', err);
      res.redirect(`/login?error=${encodeURIComponent(err?.message || 'oidc_callback_error')}`);
    }
  }
}
