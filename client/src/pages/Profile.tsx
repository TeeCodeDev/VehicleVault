import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Palette,
  Sun,
  Moon,
  Globe,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { useTheme, ACCENT_COLOR_OPTIONS } from '../context/ThemeContext.js';
import { PasskeySettings } from '../components/PasskeySettings.js';
import { TwoFactorSettings } from '../components/TwoFactorSettings.js';
import { WebPushSettings } from '../components/WebPushSettings.js';
import { apiFetch } from '../api/client.js';

export const Profile: React.FC = () => {
  const { user, authDisabled } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError(
        lang === 'nl'
          ? 'Nieuwe wachtwoorden komen niet overeen.'
          : 'New passwords do not match.'
      );
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        lang === 'nl'
          ? 'Het nieuwe wachtwoord moet minimaal 8 tekens lang zijn.'
          : 'New password must be at least 8 characters long.'
      );
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setPasswordSuccess(res.message || (lang === 'nl' ? 'Wachtwoord succesvol gewijzigd.' : 'Password updated successfully.'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || (lang === 'nl' ? 'Fout bij wijzigen van wachtwoord.' : 'Failed to change password.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleLabel = (role?: string) => {
    if (role === 'admin') return lang === 'nl' ? 'Systeembeheerder' : 'System Administrator';
    if (role === 'driver') return lang === 'nl' ? 'Chauffeur' : 'Driver';
    return lang === 'nl' ? 'Standaard Gebruiker' : 'Standard User';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Profile Identity Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent-600 to-accent-400 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {user?.email || 'admin@local'}
                </h1>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300 border border-accent-200 dark:border-accent-800 uppercase tracking-wider">
                  {getRoleLabel(user?.role)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('profileSubtitle')}
              </p>
            </div>
          </div>

          {user?.role === 'admin' && (
            <NavLink
              to="/settings"
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-2xs self-start sm:self-auto"
            >
              <span>{lang === 'nl' ? 'Systeeminstellingen' : 'System Settings'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </NavLink>
          )}
        </div>
      </div>

      {/* Security Section: Passkeys, TOTP 2FA, Change Password */}
      {!authDisabled && (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-base">
            <ShieldCheck className="w-5 h-5 text-accent-500" />
            <span>{lang === 'nl' ? 'Inloggen & Beveiliging' : 'Sign-in & Security'}</span>
          </div>

          {/* Passkeys Component */}
          <PasskeySettings />

          {/* Two-Factor Authentication (TOTP 2FA) */}
          <TwoFactorSettings />

          {/* Change Password Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800/60">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('changePassword')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'nl'
                    ? 'Werk je accountwachtwoord bij. Minimaal 8 tekens.'
                    : 'Update your account password. Minimum 8 characters.'}
                </p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-xl text-xs flex items-center space-x-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 pt-2 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('currentPassword')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('newPassword')}
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('confirmPassword')}
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading || !newPassword}
                className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center space-x-2 shadow-sm"
              >
                {passwordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>{t('save')}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Personal Preferences: Language, Theme, Accent Color */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-base">
          <Palette className="w-5 h-5 text-accent-500" />
          <span>{lang === 'nl' ? 'Weergave & Voorkeuren' : 'Appearance & Preferences'}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors space-y-6">
          {/* Language selector */}
          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
              <Globe className="w-4 h-4 text-sky-500" />
              <span>{lang === 'nl' ? 'Taal / Language' : 'Language'}</span>
            </label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setLang('nl')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-2 ${
                  lang === 'nl'
                    ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-300 dark:border-accent-700 text-accent-700 dark:text-accent-300 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <span>🇳🇱 Nederlands</span>
                {lang === 'nl' && <Check className="w-3.5 h-3.5 ml-1 text-accent-600" />}
              </button>

              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-2 ${
                  lang === 'en'
                    ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-300 dark:border-accent-700 text-accent-700 dark:text-accent-300 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <span>🇬🇧 English</span>
                {lang === 'en' && <Check className="w-3.5 h-3.5 ml-1 text-accent-600" />}
              </button>
            </div>
          </div>

          {/* Theme selector */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>{lang === 'nl' ? 'Thema' : 'Theme'}</span>
            </label>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center space-y-1.5 ${
                  theme === 'light'
                    ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-400 dark:border-accent-600 text-accent-700 dark:text-accent-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="text-xs">{lang === 'nl' ? 'Licht' : 'Light'}</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center space-y-1.5 ${
                  theme === 'dark'
                    ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-400 dark:border-accent-600 text-accent-700 dark:text-accent-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="text-xs">{lang === 'nl' ? 'Donker' : 'Dark'}</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center space-y-1.5 ${
                  theme === 'system'
                    ? 'bg-accent-50 dark:bg-accent-950/60 border-accent-400 dark:border-accent-600 text-accent-700 dark:text-accent-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Laptop className="w-4 h-4 text-slate-400" />
                <span className="text-xs">{lang === 'nl' ? 'Systeem' : 'System'}</span>
              </button>
            </div>
          </div>

          {/* Accent color picker */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center space-x-2">
              <Palette className="w-4 h-4 text-accent-500" />
              <span>{lang === 'nl' ? 'Accentkleur' : 'Accent Color'}</span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAccentColor(opt.id as any)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    accentColor === opt.id
                      ? 'border-slate-900 dark:border-white ring-2 ring-accent-500/30'
                      : 'border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: opt.dotColor }}
                  />
                  <span>{lang === 'nl' ? opt.name : opt.enName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Push notifications for this device */}
      <div className="space-y-4">
        <WebPushSettings />
      </div>
    </div>
  );
};

