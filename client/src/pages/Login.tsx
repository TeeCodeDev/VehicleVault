import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, Fingerprint, ShieldCheck, Globe, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { passkeyErrorMessage } from '../utils/passkeys.js';

export const Login: React.FC = () => {
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  // 2FA state
  const [twoFactorData, setTwoFactorData] = useState<{ requires2FA: boolean; tempToken: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // OIDC state
  const [oidcConfig, setOidcConfig] = useState<{ enabled: boolean; buttonLabel: string } | null>(null);

  const { login, verify2Fa, loginWithPasskey, loginWithRecoveryCode, passkeyAvailable, passkeyUnavailableReason, user, authDisabled, hasUsers } =
    useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user || authDisabled) {
      navigate('/', { replace: true });
    }
  }, [user, authDisabled, navigate]);

  useEffect(() => {
    // Check url error parameters (e.g. from OIDC callback redirect)
    const errParam = searchParams.get('error');
    if (errParam) {
      if (errParam === 'oidc_not_configured') {
        setError(lang === 'nl' ? 'OpenID Connect (OIDC) is nog niet geconfigureerd.' : 'OIDC is not yet configured.');
      } else if (errParam === 'oidc_session_expired' || errParam === 'oidc_state_mismatch') {
        setError(lang === 'nl' ? 'De SSO aanmeldsessie is verlopen of ongeldig. Probeer opnieuw.' : 'SSO login session expired or invalid. Please retry.');
      } else {
        setError(errParam);
      }
    }

    // Fetch public OIDC config
    fetch('/api/auth/oidc/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.enabled) {
          setOidcConfig(data);
        }
      })
      .catch(() => {});
  }, [searchParams, lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password, rememberMe);
      if (res && res.requires2FA && res.tempToken) {
        setTwoFactorData({ requires2FA: true, tempToken: res.tempToken });
        setTwoFactorCode('');
        return;
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Inloggen mislukt. Controleer uw gegevens.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorData?.tempToken) return;
    setError(null);
    setLoading(true);

    try {
      await verify2Fa(twoFactorData.tempToken, twoFactorCode);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || (lang === 'nl' ? 'Ongeldige verificatiecode of herstelcode' : 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithPasskey();
      navigate('/');
    } catch (err: any) {
      setError(passkeyErrorMessage(err, lang));
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithRecoveryCode(recoveryCode);
      navigate('/settings?tab=users');
    } catch (err: any) {
      setError(err?.message || t('invalidRecoveryCode'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-7 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <img src="/icon-512.png" alt="VehicleVault" className="w-16 h-16 object-contain mb-3 drop-shadow-md" />
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">VehicleVault</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('loginTitle')}
          </p>
        </div>

        {!hasUsers && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-xl mb-4 text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5 shadow-xs">
            <div className="font-bold flex items-center space-x-1.5">
              <span>👋 Eerste Installatie</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300/90">
              Er is nog geen account aangemaakt. Maak direct je eerste account aan (krijgt automatisch beheerdersrechten).
            </p>
            <div className="pt-1">
              <Link
                to="/register"
                className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-sm"
              >
                Beheerder Account Aanmaken →
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl mb-4 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {twoFactorData ? (
          <form onSubmit={handle2FaSubmit} className="space-y-4 text-xs">
            <div className="bg-accent-50 dark:bg-accent-950/40 border border-accent-200 dark:border-accent-800/60 p-3.5 rounded-xl text-accent-900 dark:text-accent-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-accent-500" />
                <span>Tweefactorauthenticatie (2FA)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-accent-800 dark:text-accent-300/90">
                Voer de 6-cijferige verificatiecode uit je authenticator-app (of een 8-tekens herstelcode) in om in te loggen.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Verificatiecode of Herstelcode
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="one-time-code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="123456 of XXXX-XXXX"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 text-center font-mono text-base font-bold tracking-widest text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !twoFactorCode.trim()}
              className="w-full py-2.5 bg-accent-600 text-white hover:bg-accent-700 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-md hover:scale-[1.01]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{loading ? 'Verifiëren...' : 'Verifieer & Inloggen'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTwoFactorData(null);
                setTwoFactorCode('');
                setError(null);
              }}
              className="w-full py-2 bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-semibold flex items-center justify-center space-x-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Terug naar inloggen</span>
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">E-mailadres</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="bestuurder@voorbeeld.nl"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Wachtwoord</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-accent-600 focus:ring-accent-500/20"
                  />
                  <span className="text-[11px] font-medium">Blijf ingelogd</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-[11px] font-bold text-accent-600 dark:text-accent-400 hover:underline"
                >
                  Wachtwoord vergeten?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent-600 text-white hover:bg-accent-700 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center space-x-2 mt-3 shadow-md hover:scale-[1.01]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{loading ? 'Bezig met inloggen...' : 'Inloggen'}</span>
              </button>
            </form>

            {/* OIDC / SSO Button */}
            {oidcConfig?.enabled && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="/api/auth/oidc/login"
                  className="w-full py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 shadow-sm hover:scale-[1.01]"
                >
                  <Globe className="w-4 h-4" />
                  <span>{oidcConfig.buttonLabel || 'Inloggen met Single Sign-On (SSO / OIDC)'}</span>
                </a>
              </div>
            )}

            {hasUsers && (
              <div className="mt-3 space-y-2 text-xs">
                <button
                  type="button"
                  onClick={handlePasskey}
                  disabled={loading || !passkeyAvailable}
                  title={!passkeyAvailable ? passkeyUnavailableReason || undefined : undefined}
                  className="w-full py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>{t('loginWithPasskey')}</span>
                </button>
                {!passkeyAvailable && passkeyUnavailableReason && (
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{passkeyUnavailableReason}</p>
                )}

                <div className="text-center pt-1">
                  <button
                    type="button"
                    aria-expanded={showRecovery}
                    aria-controls="recovery-panel"
                    onClick={() => setShowRecovery((v) => !v)}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:underline"
                  >
                    {t('lostDevice')}
                  </button>
                </div>
                {/* Kept in the DOM and hidden with the attribute, so aria-controls always points at something real. */}
                <form id="recovery-panel" hidden={!showRecovery} onSubmit={handleRecovery} className="space-y-2 [&[hidden]]:hidden">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold" htmlFor="recovery-code">
                    {t('recoveryCode')}
                  </label>
                  <input
                    id="recovery-code"
                    type="text"
                    required
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-500 shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl font-bold transition disabled:opacity-50"
                  >
                    {t('loginWithRecoveryCode')}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
          <span>Nog geen account aangemaakt? </span>
          <Link to="/register" className="text-accent-600 dark:text-accent-400 hover:underline font-bold">
            Account Registreren
          </Link>
        </div>
      </div>
    </div>
  );
};
