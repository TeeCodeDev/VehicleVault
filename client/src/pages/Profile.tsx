import React from 'react';
import { ShieldCheck, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { PasskeySettings } from '../components/PasskeySettings.js';
import { TwoFactorSettings } from '../components/TwoFactorSettings.js';
import { WebPushSettings } from '../components/WebPushSettings.js';
import { ProfilePasswordForm } from '../components/profile/ProfilePasswordForm.js';
import { ProfilePreferencesSection } from '../components/profile/ProfilePreferencesSection.js';
import { ProfileHomeAssistantSection } from '../components/profile/ProfileHomeAssistantSection.js';

export const Profile: React.FC = () => {
  const { user, authDisabled } = useAuth();
  const { t } = useLanguage();

  const getRoleLabel = (role?: string) => {
    if (role === 'admin') return t('roleAdmin');
    if (role === 'driver') return t('roleDriver');
    return t('roleUser');
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
              <span>{t('profileSystemSettings')}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </NavLink>
          )}
        </div>
      </div>

      {/* Home Assistant & Personal API Keys (For every user!) */}
      {user?.role !== 'driver' && (
        <ProfileHomeAssistantSection />
      )}

      {/* Security Section: Passkeys, TOTP 2FA, Change Password */}
      {!authDisabled && (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-base">
            <ShieldCheck className="w-5 h-5 text-accent-500" />
            <span>{t('profileSignInSecurity')}</span>
          </div>

          {/* Passkeys Component */}
          <PasskeySettings />

          {/* Two-Factor Authentication (TOTP 2FA) */}
          <TwoFactorSettings />

          {/* Change Password Form */}
          <ProfilePasswordForm />
        </div>
      )}

      {/* Personal Preferences: Language, Theme, Accent Color */}
      <ProfilePreferencesSection />

      {/* Push notifications for this device */}
      <div className="space-y-4">
        <WebPushSettings />
      </div>

      {/* Data Import Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {t('profileImportTitle')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t('profileImportHint')}
            </p>
          </div>
        </div>
        <NavLink
          to="/import"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-2xs shrink-0 self-start sm:self-auto"
        >
          <span>{t('profileGoToImport')}</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </NavLink>
      </div>
    </div>
  );
};
