import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  Radio,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '../../api/client.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { MailSettings } from '../MailSettings.js';
import { WebPushSettings } from '../WebPushSettings.js';
import { VehicleNotificationsList } from './VehicleNotificationsList.js';

export const NotificationsSettingsTab: React.FC = () => {
  const { t } = useLanguage();

  const [notifProvider, setNotifProvider] = useState<'none' | 'email' | 'webpush' | 'pushover' | 'ntfy' | 'gotify' | 'webhook'>('none');
  const [pushoverUserKey, setPushoverUserKey] = useState('');
  const [pushoverApiToken, setPushoverApiToken] = useState('');
  const [pushoverDevice, setPushoverDevice] = useState('');
  const [ntfyUrl, setNtfyUrl] = useState('');
  const [ntfyToken, setNtfyToken] = useState('');
  const [gotifyUrl, setGotifyUrl] = useState('');
  const [gotifyToken, setGotifyToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [notifApk, setNotifApk] = useState(true);
  const [notifMaintenance, setNotifMaintenance] = useState(true);
  const [notifTireSwap, setNotifTireSwap] = useState(true);
  const [notifTireTread, setNotifTireTread] = useState(true);
  const [notifTesting, setNotifTesting] = useState(false);
  const [notifTestResult, setNotifTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaveSuccess, setNotifSaveSuccess] = useState(false);

  const loadNotificationSettings = async () => {
    try {
      const res = await apiFetch<any>('/api/notifications/settings');
      setNotifProvider(new URLSearchParams(window.location.search).has('mail') ? 'email' : res.provider || 'none');
      setPushoverUserKey(res.pushoverUserKey || '');
      setPushoverApiToken(res.pushoverApiToken || '');
      setPushoverDevice(res.pushoverDevice || '');
      setNtfyUrl(res.ntfyUrl || '');
      setNtfyToken(res.ntfyToken || '');
      setGotifyUrl(res.gotifyUrl || '');
      setGotifyToken(res.gotifyToken || '');
      setWebhookUrl(res.webhookUrl || '');
      setNotifApk(res.enabledApk ?? true);
      setNotifMaintenance(res.enabledMaintenance ?? true);
      setNotifTireSwap(res.enabledTireSwap ?? true);
      setNotifTireTread(res.enabledTireTread ?? true);
    } catch {}
  };

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const handleSaveNotifications = async () => {
    setNotifSaving(true);
    setNotifSaveSuccess(false);
    try {
      await apiFetch('/api/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({
          provider: notifProvider,
          pushoverUserKey,
          pushoverApiToken,
          pushoverDevice,
          ntfyUrl,
          ntfyToken,
          gotifyUrl,
          gotifyToken,
          webhookUrl,
          enabledApk: notifApk,
          enabledMaintenance: notifMaintenance,
          enabledTireSwap: notifTireSwap,
          enabledTireTread: notifTireTread,
        }),
      });
      setNotifSaveSuccess(true);
      setTimeout(() => setNotifSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || t('notifSaveFailed'));
    } finally {
      setNotifSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setNotifTesting(true);
    setNotifTestResult(null);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/notifications/test', {
        method: 'POST',
      });
      setNotifTestResult(res);
    } catch (err: any) {
      setNotifTestResult({ success: false, message: err?.message || t('notifTestFailed') });
    } finally {
      setNotifTesting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Bell className="w-4 h-4 text-purple-500" />
          <span>{t('notifTitle')}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('notifSubtitle')}
        </p>
      </div>

      {/* Provider Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {[
          { id: 'none', label: t('notifProviderDisabled') },
          { id: 'webpush', label: 'Web Push (PWA)' },
          { id: 'email', label: t('notifProviderEmail') },
          { id: 'pushover', label: 'Pushover' },
          { id: 'ntfy', label: 'Ntfy.sh / Self-Hosted' },
          { id: 'gotify', label: 'Gotify' },
          { id: 'webhook', label: t('notifProviderWebhook') },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setNotifProvider(p.id as any)}
            className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
              notifProvider === p.id
                ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 text-slate-900 dark:text-white ring-1 ring-purple-500'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Provider Specific Inputs */}
      {notifProvider === 'webpush' && <WebPushSettings />}

      {notifProvider === 'pushover' && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Pushover User Key *
              </label>
              <input
                type="text"
                value={pushoverUserKey}
                onChange={(e) => setPushoverUserKey(e.target.value)}
                placeholder={t('pushoverUserKeyPlaceholder')}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Pushover Application API Token *
              </label>
              <input
                type="password"
                value={pushoverApiToken}
                onChange={(e) => setPushoverApiToken(e.target.value)}
                placeholder={t('pushoverTokenPlaceholder')}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {t('pushoverDeviceLabel')}
            </label>
            <input
              type="text"
              value={pushoverDevice}
              onChange={(e) => setPushoverDevice(e.target.value)}
              placeholder={t('pushoverDevicePlaceholder')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      )}

      {notifProvider === 'email' && <MailSettings />}

      {notifProvider === 'ntfy' && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {t('ntfyUrlLabel')}
            </label>
            <input
              type="text"
              value={ntfyUrl}
              onChange={(e) => setNtfyUrl(e.target.value)}
              placeholder={t('ntfyUrlPlaceholder')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {t('ntfyTokenLabel')}
            </label>
            <input
              type="password"
              value={ntfyToken}
              onChange={(e) => setNtfyToken(e.target.value)}
              placeholder="tk_..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      )}

      {notifProvider === 'gotify' && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Gotify Server URL *
            </label>
            <input
              type="text"
              value={gotifyUrl}
              onChange={(e) => setGotifyUrl(e.target.value)}
              placeholder={t('gotifyUrlPlaceholder')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Gotify App Token *
            </label>
            <input
              type="password"
              value={gotifyToken}
              onChange={(e) => setGotifyToken(e.target.value)}
              placeholder="A..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      )}

      {notifProvider === 'webhook' && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Webhook URL (POST) *
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://webhook.site/..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      )}

      {/* Notification Triggers */}
      {notifProvider !== 'none' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
          <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={notifApk}
              onChange={(e) => setNotifApk(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {t('notifTriggerApk')}
            </span>
          </label>

          <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={notifMaintenance}
              onChange={(e) => setNotifMaintenance(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {t('notifTriggerMaintenance')}
            </span>
          </label>

          <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={notifTireSwap}
              onChange={(e) => setNotifTireSwap(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {t('notifTriggerTireSwap')}
            </span>
          </label>

          <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={notifTireTread}
              onChange={(e) => setNotifTireTread(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {t('notifTriggerTireTread')}
            </span>
          </label>

          <VehicleNotificationsList />
        </div>
      )}

      {/* Test Result Message */}
      {notifTestResult && (
        <div
          className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs font-medium ${
            notifTestResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {notifTestResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          )}
          <span>{notifTestResult.message}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        {notifProvider !== 'none' ? (
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={notifTesting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-2 transition disabled:opacity-50"
          >
            {notifTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : notifProvider === 'email' ? (
              <Mail className="w-3.5 h-3.5 text-purple-500" />
            ) : (
              <Radio className="w-3.5 h-3.5 text-purple-500" />
            )}
            <span>
              {notifTesting
                ? t('notifSending')
                : notifProvider === 'email'
                ? t('notifSendTestEmail')
                : t('notifSendTest')}
            </span>
          </button>
        ) : <div />}

        <div className="flex items-center space-x-2">
          {notifSaveSuccess && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>{t('notifSaved')}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveNotifications}
            disabled={notifSaving}
            className="px-5 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
          >
            {notifSaving ? t('saving') : t('notifSave')}
          </button>
        </div>
      </div>
    </div>
  );
};

