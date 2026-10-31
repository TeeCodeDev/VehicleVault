import React, { useCallback, useEffect, useState } from 'react';
import {
  Globe,
  Check,
  Copy,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';

interface OidcAdminConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecretConfigured: boolean;
  redirectUri: string;
  scopes: string;
  buttonLabel: string;
}

export const OidcSettings: React.FC = () => {
  const { lang } = useLanguage();
  const { user, authDisabled } = useAuth();
  const nl = lang === 'nl';

  const [, setConfig] = useState<OidcAdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Form fields
  const [enabled, setEnabled] = useState(false);
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [scopes, setScopes] = useState('openid profile email');
  const [buttonLabel, setButtonLabel] = useState('Inloggen met Single Sign-On (OIDC)');

  const loadSettings = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      setLoading(true);
      const res = await apiFetch<OidcAdminConfig>('/api/auth/oidc/settings');
      setConfig(res);
      setEnabled(res.enabled);
      setIssuer(res.issuer || '');
      setClientId(res.clientId || '');
      setClientSecret(res.clientSecretConfigured ? '••••••••••••••••' : '');
      setRedirectUri(res.redirectUri || `${window.location.origin}/api/auth/oidc/callback`);
      setScopes(res.scopes || 'openid profile email');
      setButtonLabel(res.buttonLabel || 'Inloggen met Single Sign-On (OIDC)');
    } catch {
      // not admin or error
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (authDisabled || user?.role !== 'admin') return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (enabled && !issuer.trim()) {
      setError(
        nl
          ? 'Vul a.u.b. de Issuer URL van je Identity Provider in (bijv. van Authentik, Authelia of Keycloak) om SSO te activeren.'
          : 'Please enter the Issuer URL of your Identity Provider to enable SSO.'
      );
      return;
    }

    if (enabled && !clientId.trim()) {
      setError(
        nl
          ? 'Vul a.u.b. de Client ID in om SSO in te schakelen.'
          : 'Please enter the Client ID to enable SSO.'
      );
      return;
    }

    setSaving(true);

    try {
      await apiFetch('/api/auth/oidc/settings', {
        method: 'POST',
        body: JSON.stringify({
          enabled,
          issuer: issuer.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: redirectUri.trim(),
          scopes: scopes.trim(),
          buttonLabel: buttonLabel.trim(),
        }),
      });
      setSuccess(
        nl
          ? 'OpenID Connect / SSO instellingen succesvol opgeslagen!'
          : 'OIDC / SSO settings saved successfully!'
      );
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || (nl ? 'Fout bij opslaan van SSO instellingen' : 'Failed to save SSO settings'));
    } finally {
      setSaving(false);
    }
  };

  const copyCallbackUrl = () => {
    const url = redirectUri || `${window.location.origin}/api/auth/oidc/callback`;
    navigator.clipboard.writeText(url);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-center text-xs text-slate-400">
        SSO instellingen laden...
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Globe className="w-4 h-4 text-accent-500" />
            <span>{nl ? 'OpenID Connect / Single Sign-On (OIDC)' : 'OpenID Connect / SSO (OIDC)'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {nl
              ? 'Koppel externe identity providers zoals Authentik, Keycloak, Authelia, Okta, Cloudflare Access of Google Workspace.'
              : 'Integrate external identity providers like Authentik, Keycloak, Authelia, Okta, Cloudflare Access, or Google Workspace.'}
          </p>
        </div>

        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center space-x-1.5 self-start sm:self-center ${
            enabled && issuer.trim() && clientId.trim()
              ? 'bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300 border-accent-300 dark:border-accent-800/60'
              : enabled
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>
            {enabled && issuer.trim() && clientId.trim()
              ? (nl ? 'SSO Actief' : 'SSO Active')
              : enabled
              ? (nl ? 'SSO Incompleet (Issuer URL vereist)' : 'SSO Incomplete (Issuer URL required)')
              : (nl ? 'SSO Uitgeschakeld' : 'SSO Inactive')}
          </span>
        </span>
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs p-3 rounded-xl font-medium">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
          <div className="space-y-0.5 pr-4">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              {nl ? 'OpenID Connect Inlogknop Activeren' : 'Enable OpenID Connect Login'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {nl
                ? 'Toont een SSO-aanmeldknop op het inlogscherm waarmee gebruikers via je identity provider kunnen inloggen.'
                : 'Shows an SSO sign-in button on the login screen for one-click authentication.'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? 'bg-accent-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Callback URI info box */}
        <div className="p-3.5 rounded-xl bg-accent-50/50 dark:bg-accent-950/20 border border-accent-200/80 dark:border-accent-800/40 space-y-1.5">
          <span className="font-bold text-accent-950 dark:text-accent-200 block text-xs">
            {nl ? 'Redirect URI / Callback URL voor je Identity Provider:' : 'Redirect URI for Identity Provider:'}
          </span>
          <div className="flex items-center space-x-2">
            <code className="flex-1 bg-white dark:bg-slate-900 border border-accent-200 dark:border-accent-800/60 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-slate-800 dark:text-slate-200 overflow-x-auto select-all">
              {redirectUri || `${window.location.origin}/api/auth/oidc/callback`}
            </code>
            <button
              type="button"
              onClick={copyCallbackUrl}
              className="px-3 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg font-bold text-xs transition flex items-center space-x-1 shrink-0 shadow-xs"
            >
              {copiedCallback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCallback ? (nl ? 'Gekopieerd' : 'Copied') : (nl ? 'Kopiëren' : 'Copy')}</span>
            </button>
          </div>
          <span className="text-[10px] text-accent-700 dark:text-accent-400 block">
            {nl
              ? 'Kopieer deze URL naar de "Redirect URIs" configuratie in Authentik, Keycloak of Authelia.'
              : 'Add this exact URL to the Allowed Redirect URIs in your identity provider.'}
          </span>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {nl ? 'Issuer URL (OpenID Discovery Endpoint basis) *' : 'Issuer URL *'}
            </label>
            <input
              type="url"
              required={enabled}
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder={nl ? "Bijv. https://auth.uw-domein.nl/application/o/vehiclevault/" : "e.g. https://auth.yourdomain.com/application/o/vehiclevault/"}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              {nl
                ? 'Verplicht. De URL van uw provider (VehicleVault leest automatisch /.well-known/openid-configuration uit).'
                : 'Required. Issuer base URL (VehicleVault reads /.well-known/openid-configuration automatically).'}
            </span>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Client ID *
            </label>
            <input
              type="text"
              required={enabled}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="vehiclevault"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Client Secret (optioneel bij PKCE public client)
            </label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {nl ? 'Knoptekst op inlogscherm' : 'Sign-in Button Label'}
            </label>
            <input
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Inloggen met Single Sign-On (OIDC)"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Scopes
            </label>
            <input
              type="text"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="openid profile email"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50 hover:scale-[1.01]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{nl ? 'Instellingen Opslaan' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
