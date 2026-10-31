import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, BellOff, Smartphone, Trash2, Loader2, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  PushDevice,
  describeDevice,
  disablePush,
  enablePush,
  getBrowserSubscription,
  pushUnsupportedReason,
  removeDevice,
} from '../utils/webPush.js';

interface PushStatus {
  subscriptions: PushDevice[];
  totalDevices: number;
}

/** Per-device Web Push: every person enables it on their own phone / computer; the provider choice is global. */
export const WebPushSettings: React.FC = () => {
  const { lang } = useLanguage();
  const nl = lang === 'nl';

  const [status, setStatus] = useState<PushStatus | null>(null);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const unsupported = pushUnsupportedReason();

  const load = useCallback(async () => {
    try {
      setStatus(await apiFetch<PushStatus>('/api/notifications/push/status'));
      if (!pushUnsupportedReason()) {
        setThisEndpoint((await getBrowserSubscription())?.endpoint ?? null);
      }
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const thisDeviceEnabled = Boolean(thisEndpoint && status?.subscriptions.some((s) => s.endpoint === thisEndpoint));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        setFeedback({
          ok: false,
          text: nl
            ? 'Meldingen zijn geblokkeerd voor deze site. Sta ze toe in de instellingen van je browser of telefoon en probeer opnieuw.'
            : 'Notifications are blocked for this site. Allow them in your browser or phone settings and try again.',
        });
      } else {
        setFeedback({ ok: false, text: err?.message || (nl ? 'Er ging iets mis.' : 'Something went wrong.') });
      }
    } finally {
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
      await load();
      setBusy(false);
    }
  };

  const handleEnable = () =>
    run(async () => {
      await enablePush();
      setFeedback({
        ok: true,
        text: nl ? 'Meldingen staan aan op dit apparaat.' : 'Notifications are on for this device.',
      });
    });

  const handleDisable = () =>
    run(async () => {
      await disablePush();
      setFeedback({ ok: true, text: nl ? 'Meldingen staan uit op dit apparaat.' : 'Notifications are off for this device.' });
    });

  const handleTest = () =>
    run(async () => {
      const res = await apiFetch<{ message: string }>('/api/notifications/push/test', { method: 'POST' });
      setFeedback({ ok: true, text: res.message });
    });

  const handleRemove = (device: PushDevice) => {
    if (!confirm(nl ? 'Dit apparaat geen meldingen meer sturen?' : 'Stop sending notifications to this device?')) return;
    run(async () => {
      await removeDevice(device.endpoint);
      // Removing the current browser's registration also drops its local subscription.
      if (device.endpoint === thisEndpoint) await (await getBrowserSubscription())?.unsubscribe();
    });
  };

  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(nl ? 'nl-NL' : 'en-GB') : null);

  const unsupportedText = (() => {
    if (unsupported === 'insecure') {
      return nl
        ? 'Web Push werkt alleen via HTTPS (of localhost). Open VehicleVault via een https-adres, bijvoorbeeld achter je reverse proxy.'
        : 'Web Push only works over HTTPS (or localhost). Open VehicleVault through an https address, for example behind your reverse proxy.';
    }
    if (unsupported === 'ios-not-installed') {
      return nl
        ? 'Op iPhone en iPad (iOS/iPadOS 16.4 of nieuwer) werken meldingen alleen voor de geïnstalleerde app: tik op Deel → "Zet op beginscherm", open VehicleVault vanaf het beginscherm en kom hier terug.'
        : 'On iPhone and iPad (iOS/iPadOS 16.4 or newer) notifications only work for the installed app: tap Share → "Add to Home Screen", open VehicleVault from the home screen and come back here.';
    }
    return nl ? 'Deze browser ondersteunt geen Web Push.' : 'This browser does not support Web Push.';
  })();

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4 text-xs">
      <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg text-sky-800 dark:text-sky-300">
        <span className="font-bold block">
          {nl ? '💡 Rechtstreeks naar de app, zonder extra dienst' : '💡 Straight to the app, no extra service'}
        </span>
        <span className="text-[11px] block mt-0.5 leading-relaxed">
          {nl
            ? 'Meldingen komen via de push-dienst van je eigen browser (Google, Apple, Mozilla of Microsoft) binnen als de app is geïnstalleerd of de browser open staat. Elke persoon schakelt dit zelf in op zijn of haar apparaat; de APK-, onderhouds- en documentmeldingen gaan naar alle ingeschakelde apparaten.'
            : "Notifications arrive through your own browser's push service (Google, Apple, Mozilla or Microsoft), also when the app is installed but closed. Everyone turns this on for their own device; APK, maintenance and document alerts go to all enabled devices."}
        </span>
      </div>

      {unsupported ? (
        <div className="flex items-start space-x-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="leading-relaxed">{unsupportedText}</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {thisDeviceEnabled ? (
              <button
                type="button"
                onClick={handleDisable}
                disabled={busy}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
                <span>{nl ? 'Uitschakelen op dit apparaat' : 'Turn off on this device'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnable}
                disabled={busy || permission === 'denied'}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
                <span>{nl ? 'Inschakelen op dit apparaat' : 'Turn on for this device'}</span>
              </button>
            )}

            {thisDeviceEnabled && (
              <button
                type="button"
                onClick={handleTest}
                disabled={busy}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-50 dark:hover:bg-purple-950/40 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{nl ? 'Stuur test naar mijn apparaten' : 'Send test to my devices'}</span>
              </button>
            )}
          </div>

          {permission === 'denied' && !thisDeviceEnabled && (
            <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
              {nl
                ? 'Meldingen zijn voor deze site geblokkeerd. Sta ze toe in de site-instellingen van je browser (of Instellingen → Meldingen op je telefoon) en laad de pagina opnieuw.'
                : 'Notifications are blocked for this site. Allow them in your browser site settings (or Settings → Notifications on your phone) and reload the page.'}
            </p>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-start space-x-2 p-3 rounded-lg border ${
            feedback.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span className="leading-relaxed">{feedback.text}</span>
        </div>
      )}

      <div>
        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {nl ? 'Mijn apparaten' : 'My devices'}
          {status && (
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {' · '}
              {nl ? `${status.totalDevices} in totaal op deze server` : `${status.totalDevices} in total on this server`}
            </span>
          )}
        </div>
        {status && status.subscriptions.length > 0 ? (
          <ul className="space-y-1.5">
            {status.subscriptions.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <Smartphone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {describeDevice(d.userAgent)}
                      {d.endpoint === thisEndpoint && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">
                          {nl ? 'dit apparaat' : 'this device'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {nl ? 'Ingeschakeld op' : 'Enabled on'} {formatDate(d.createdAt)}
                      {d.lastUsedAt ? ` · ${nl ? 'laatste melding' : 'last alert'} ${formatDate(d.lastUsedAt)}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(d)}
                  disabled={busy}
                  aria-label={nl ? 'Apparaat verwijderen' : 'Remove device'}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">
            {nl ? 'Nog geen apparaten ingeschakeld voor jouw account.' : 'No devices enabled for your account yet.'}
          </p>
        )}
      </div>
    </div>
  );
};
