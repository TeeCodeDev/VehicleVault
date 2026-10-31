import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Mail, ShieldCheck, Send, CheckCircle2, AlertCircle, Save, Copy, Check, LogIn, Trash2, X } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';
import { EMAIL_PRESETS, applyEmailPreset } from '../utils/emailPresets.js';

type Transport = 'microsoft' | 'gmail' | 'smtp' | 'graph';

interface MailConfig {
  transport: Transport;
  configured: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    to: string;
    ignoreTlsErrors: boolean;
    requireTls: boolean;
  };
  graph: { tenantId: string; clientId: string; clientSecret: string; sender: string };
  microsoft: { signedIn: boolean; mailbox?: string; tenantId?: string; clientId?: string; ownApp: boolean };
  google: {
    signedIn: boolean;
    account?: string;
    clientId?: string;
    hasClientSecret: boolean;
    redirectUri: string;
    lastResult?: { ok: boolean; message: string };
  };
}

interface DeviceSignIn {
  id: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
}

const inputClass =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono';
const labelClass = 'font-semibold text-slate-700 dark:text-slate-300 block mb-1';

/**
 * Mail settings shared by the notification provider "E-mail" and the password-reset mails: SMTP (with presets
 * for Gmail / Microsoft 365 / Outlook.com) or Microsoft Graph. It saves on its own, before it checks or sends.
 */
export const MailSettings: React.FC = () => {
  const { lang } = useLanguage();
  const nl = lang === 'nl';
  const tr = (n: string, e: string) => (nl ? n : e);

  const [transport, setTransport] = useState<Transport>('microsoft');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ignoreTlsErrors, setIgnoreTlsErrors] = useState(false);
  const [requireTls, setRequireTls] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);

  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [sender, setSender] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const [msStatus, setMsStatus] = useState<MailConfig['microsoft']>({ signedIn: false, ownApp: false });
  const [msTenant, setMsTenant] = useState('');
  const [msClient, setMsClient] = useState('');
  const [device, setDevice] = useState<DeviceSignIn | null>(null);

  const [googleStatus, setGoogleStatus] = useState<MailConfig['google']>({ signedIn: false, hasClientSecret: false, redirectUri: '' });
  const [gClientId, setGClientId] = useState('');
  const [gClientSecret, setGClientSecret] = useState('');
  const [showGSecret, setShowGSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<'save' | 'verify' | 'test' | 'signin' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<MailConfig>('/api/notifications/mail');
      setTransport(res.transport);
      setHost(res.smtp.host);
      setPort(res.smtp.port || 587);
      setSecure(res.smtp.secure);
      setUser(res.smtp.user);
      setPass(res.smtp.pass);
      setFrom(res.smtp.from);
      setTo(res.smtp.to);
      setIgnoreTlsErrors(res.smtp.ignoreTlsErrors);
      setRequireTls(res.smtp.requireTls);
      setTenantId(res.graph.tenantId);
      setClientId(res.graph.clientId);
      setClientSecret(res.graph.clientSecret);
      setSender(res.graph.sender);
      setMsStatus(res.microsoft);
      setMsTenant(res.microsoft.ownApp ? (res.microsoft.tenantId ?? '') : '');
      setMsClient(res.microsoft.ownApp ? (res.microsoft.clientId ?? '') : '');
      setGoogleStatus(res.google);
      setGClientId(res.google.clientId ?? '');
      setGClientSecret(res.google.hasClientSecret ? '••••••••' : '');
      if (new URLSearchParams(window.location.search).has('mail')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('mail');
        window.history.replaceState({}, '', url.toString());
      }
      // Back from Google: the server keeps the outcome, shown once.
      if (res.google.lastResult) setResult({ ok: res.google.lastResult.ok, text: res.google.lastResult.message });
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || tr('Instellingen laden mislukt.', 'Could not load the settings.') });
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    await apiFetch('/api/notifications/mail', {
      method: 'PUT',
      body: JSON.stringify({
        transport,
        smtp: { host, port: Number(port) || 587, secure, user, pass, from, to, ignoreTlsErrors, requireTls },
        graph: { tenantId, clientId, clientSecret, sender },
        google: { clientId: gClientId, clientSecret: gClientSecret },
      }),
    });
  };

  // ---- Microsoft 365: sign in with a device code ----

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  };
  useEffect(() => stopPolling, []);

  const startMicrosoft = async () => {
    setBusy('signin');
    setResult(null);
    stopPolling();
    try {
      const started = await apiFetch<DeviceSignIn>('/api/notifications/mail/microsoft/signin', {
        method: 'POST',
        body: JSON.stringify({ tenantId: msTenant.trim(), clientId: msClient.trim() }),
      });
      setDevice(started);
      pollTimer.current = setInterval(async () => {
        try {
          const res = await apiFetch<{ state: 'pending' | 'failed' | 'done'; message?: string }>('/api/notifications/mail/microsoft/signin/status', {
            method: 'POST',
            body: JSON.stringify({ id: started.id }),
          });
          if (res.state === 'pending') return;
          stopPolling();
          setDevice(null);
          setResult({ ok: res.state === 'done', text: res.message ?? '' });
          if (res.state === 'done') await load();
        } catch (err: any) {
          stopPolling();
          setDevice(null);
          setResult({ ok: false, text: err?.message || tr('Er ging iets mis.', 'Something went wrong.') });
        }
      }, 3000);
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || tr('Aanmelden starten is mislukt.', 'Could not start signing in.') });
    } finally {
      setBusy(null);
    }
  };

  const cancelMicrosoft = async () => {
    stopPolling();
    const id = device?.id;
    setDevice(null);
    if (id) await apiFetch('/api/notifications/mail/microsoft/signin/cancel', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => undefined);
  };

  const removeConnection = async (kind: 'microsoft' | 'google') => {
    if (!confirm(tr('De koppeling uit VehicleVault verwijderen? Er wordt dan geen mail meer via dit account verstuurd.', 'Remove the connection from VehicleVault? No mail will be sent through this account any more.'))) return;
    try {
      const res = await apiFetch<{ message: string }>(`/api/notifications/mail/${kind}`, { method: 'DELETE' });
      setResult({ ok: true, text: res.message });
      await load();
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || tr('Er ging iets mis.', 'Something went wrong.') });
    }
  };

  // ---- Gmail: sign in with Google ----

  const connectGoogle = async () => {
    setBusy('signin');
    setResult(null);
    try {
      await save();
      const { url } = await apiFetch<{ url: string }>('/api/notifications/mail/google/start', { method: 'POST' });
      window.location.assign(url);
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || tr('Verbinden met Google is mislukt.', 'Could not connect to Google.') });
      setBusy(null);
    }
  };

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(googleStatus.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const run = (kind: 'save' | 'verify' | 'test') => async () => {
    setBusy(kind);
    setResult(null);
    try {
      await save();
      if (kind === 'save') {
        setResult({ ok: true, text: tr('E-mailinstellingen opgeslagen.', 'Mail settings saved.') });
      } else {
        const res = await apiFetch<{ message: string }>(
          kind === 'verify' ? '/api/notifications/mail/verify' : '/api/notifications/mail/test',
          { method: 'POST', body: kind === 'test' ? JSON.stringify({}) : undefined }
        );
        setResult({ ok: true, text: res.message });
      }
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || tr('Er ging iets mis.', 'Something went wrong.') });
    } finally {
      setBusy(null);
    }
  };

  const activePreset = EMAIL_PRESETS.find((p) => p.id === preset && p.host === host);

  if (!loaded) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
        {tr('Laden...', 'Loading...')}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4 text-xs">
      <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg text-sky-800 dark:text-sky-300">
        <span className="font-bold block">{tr('💡 Gedeelde e-mailservice', '💡 Shared mail service')}</span>
        <span className="text-[11px] block mt-0.5">
          {tr(
            'Deze instellingen gelden voor periodieke APK-, onderhouds- en documentmeldingen én voor wachtwoordherstel-links naar gebruikers.',
            'These settings are used for APK, maintenance and document alerts and for password-reset links sent to users.'
          )}
        </span>
      </div>

      {/* Transport */}
      <div>
        <span className={labelClass}>{tr('Verzenden via', 'Send through')}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              { id: 'microsoft', label: 'Microsoft 365', sub: tr('Aanmelden met je account, geen app-registratie nodig', 'Sign in with your account, no app registration needed') },
              { id: 'gmail', label: 'Gmail', sub: tr('Verbinden met Google (eigen OAuth-client, eenmalig)', 'Connect to Google (your own OAuth client, once)') },
              { id: 'smtp', label: 'SMTP', sub: tr('Eigen server, of Gmail/Outlook.com met app-wachtwoord', 'Own server, or Gmail/Outlook.com with an app password') },
              { id: 'graph', label: tr('Microsoft Graph (eigen app)', 'Microsoft Graph (own app)'), sub: tr('Geavanceerd: app-registratie met clientgeheim', 'Advanced: app registration with a client secret') },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTransport(t.id)}
              className={`p-3 rounded-xl border text-left transition ${
                transport === t.id
                  ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 ring-1 ring-purple-500'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="font-bold block text-slate-900 dark:text-white">{t.label}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {transport === 'microsoft' && (
        <div className="space-y-3">
          {msStatus.signedIn && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300">
              <span>
                <strong>{tr('Aangemeld als', 'Signed in as')} {msStatus.mailbox}</strong>
                <span className="block text-[11px] opacity-80">
                  {msStatus.ownApp ? `${tr('Eigen app', 'Own app')} ${msStatus.clientId}` : tr('Microsoft Graph Command Line Tools (van Microsoft)', 'Microsoft Graph Command Line Tools (by Microsoft)')}
                </span>
              </span>
              <button type="button" onClick={() => removeConnection('microsoft')} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/50">
                <Trash2 className="w-3.5 h-3.5" />
                <span>{tr('Uit de app verwijderen', 'Remove from the app')}</span>
              </button>
            </div>
          )}

          {device ? (
            <div role="status" className="p-4 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 space-y-2">
              <p className="text-sky-900 dark:text-sky-200">
                <strong>{tr('Voer deze code in', 'Enter this code')}</strong> {tr('op', 'at')}{' '}
                <a href={device.verificationUri} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                  {device.verificationUri}
                </a>
                :
              </p>
              <p className="text-2xl font-mono font-bold tracking-widest text-slate-900 dark:text-white select-all">{device.userCode}</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {tr('Meld je aan met het account waarvandaan de mail verstuurd moet worden. Deze pagina wacht tot het gelukt is; de code is geldig tot', 'Sign in with the account the mail should be sent from. This page waits until it is done; the code is valid until')}{' '}
                {new Date(device.expiresAt).toLocaleTimeString(nl ? 'nl-NL' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}.
              </p>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{tr('Wachten op aanmelding...', 'Waiting for sign-in...')}</span>
                <button type="button" onClick={cancelMicrosoft} className="ml-auto inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-3.5 h-3.5" />
                  <span>{tr('Annuleren', 'Cancel')}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                <li>{tr('Kies Aanmelden: VehicleVault vraagt Microsoft om een code en toont die hier.', 'Choose Sign in: VehicleVault asks Microsoft for a code and shows it here.')}</li>
                <li>{tr('Open de Microsoft-pagina, voer de code in en meld je aan met het account van de mailbox (een werk- of schoolaccount met een mailbox). Geef toestemming om mail te versturen.', 'Open the Microsoft page, enter the code and sign in with the mailbox account (a work or school account with a mailbox). Allow sending mail.')}</li>
                <li>{tr('Klaar: deze pagina ziet dat het gelukt is. Je hoeft niets in Azure of Exchange te doen.', 'Done: this page sees that it worked. You do not have to do anything in Azure or Exchange.')}</li>
              </ol>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {tr(
                  'VehicleVault mag alleen mail versturen als dit account (het recht Mail.Send); lezen kan niet. De aanmelding blijft geldig zolang hij gebruikt wordt en het wachtwoord niet verandert. Intrekken kan bij Microsoft (Mijn account → Mijn apps) of met Uit de app verwijderen. Een persoonlijk Outlook.com-account werkt hiermee niet: gebruik daarvoor SMTP.',
                  'VehicleVault can only send mail as this account (the Mail.Send permission); it cannot read. The sign-in stays valid while it is used and the password does not change. Revoke it at Microsoft (My account → My apps) or with Remove from the app. A personal Outlook.com account does not work with this: use SMTP for that.'
                )}
              </p>
              <button
                type="button"
                onClick={startMicrosoft}
                disabled={busy !== null}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
              >
                {busy === 'signin' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                <span>{msStatus.signedIn ? tr('Opnieuw aanmelden', 'Sign in again') : tr('Aanmelden bij Microsoft 365', 'Sign in to Microsoft 365')}</span>
              </button>
              <details className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">{tr('Geavanceerd (organisatie of eigen app)', 'Advanced (organization or own app)')}</summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Tenant ID ({tr('optioneel', 'optional')})</label>
                    <input type="text" value={msTenant} onChange={(e) => setMsTenant(e.target.value)} placeholder="contoso.onmicrosoft.com" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Client ID ({tr('optioneel', 'optional')})</label>
                    <input type="text" value={msClient} onChange={(e) => setMsClient(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className={inputClass} />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {tr(
                    'Standaard gebruikt VehicleVault de openbare aanmelding van Microsoft zelf. Blokkeert je organisatie die, maak dan in Entra ID een app-registratie als openbare client (apparaatcode-stroom aan) met het gedelegeerde recht Mail.Send en vul hier het client-id in.',
                    "By default VehicleVault uses Microsoft's own public sign-in. If your organization blocks it, create an app registration in Entra ID as a public client (device code flow on) with the delegated Mail.Send permission and enter its client ID here."
                  )}
                </p>
              </details>
            </>
          )}
        </div>
      )}

      {transport === 'gmail' && (
        <div className="space-y-3">
          {googleStatus.signedIn && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300">
              <strong>{tr('Verbonden met Google als', 'Connected to Google as')} {googleStatus.account}</strong>
              <button type="button" onClick={() => removeConnection('google')} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/50">
                <Trash2 className="w-3.5 h-3.5" />
                <span>{tr('Uit de app verwijderen', 'Remove from the app')}</span>
              </button>
            </div>
          )}

          <details className="rounded-lg border border-slate-200 dark:border-slate-800 p-3" open={!googleStatus.hasClientSecret}>
            <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              {tr('Eenmalig: een OAuth-client maken bij Google', 'Once: create an OAuth client at Google')}
            </summary>
            <ol className="mt-3 list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
              <li>{tr('Open Google Cloud Console en maak een project (of kies er een).', 'Open Google Cloud Console and create a project (or pick one).')}</li>
              <li>{tr("API's en services → Bibliotheek → zet de Gmail API aan.", 'APIs & Services → Library → enable the Gmail API.')}</li>
              <li>{tr('OAuth-toestemmingsscherm: kies Extern, vul een naam en je e-mailadres in en voeg het recht gmail.send toe. Zet de publicatiestatus op In productie: bij Testen verloopt de aanmelding na 7 dagen.', 'OAuth consent screen: choose External, enter a name and your email and add the gmail.send scope. Set the publishing status to In production: with Testing the sign-in expires after 7 days.')}</li>
              <li>{tr('Inloggegevens → Inloggegevens maken → OAuth-client-ID, type Webtoepassing. Voeg onder Geautoriseerde omleidings-URI’s deze URL toe:', 'Credentials → Create credentials → OAuth client ID, type Web application. Under Authorized redirect URIs add this URL:')}</li>
            </ol>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-white">{googleStatus.redirectUri}</code>
              <button type="button" onClick={copyRedirect} aria-label={tr('Kopieer URL', 'Copy URL')} className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {googleStatus.redirectUri.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(googleStatus.redirectUri) && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                {tr(
                  'Google accepteert alleen https (of localhost) als omleidings-URL. Open VehicleVault via https, of zet PUBLIC_URL op het https-adres.',
                  'Google only accepts https (or localhost) as redirect URL. Open VehicleVault over https, or set PUBLIC_URL to the https address.'
                )}
              </p>
            )}
            <p className="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
              {tr('Plak daarna het client-ID en het client-geheim hieronder. Het geheim wordt versleuteld bewaard en niet meer getoond.', 'Then paste the client ID and client secret below. The secret is stored encrypted and not shown again.')}
            </p>
          </details>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Client ID *</label>
              <input type="text" value={gClientId} onChange={(e) => setGClientId(e.target.value)} placeholder="123456789012-abc….apps.googleusercontent.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tr('Client-geheim *', 'Client secret *')}</label>
              <div className="relative">
                <input type={showGSecret ? 'text' : 'password'} value={gClientSecret} onChange={(e) => setGClientSecret(e.target.value)} className={`${inputClass} pr-10`} />
                <button type="button" onClick={() => setShowGSecret(!showGSecret)} aria-label={showGSecret ? tr('Verberg geheim', 'Hide secret') : tr('Toon geheim', 'Show secret')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showGSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {tr(
              'VehicleVault mag alleen mail versturen als het Google-account (gmail.send); lezen kan niet. Google toont een melding dat de app niet is geverifieerd: kies Geavanceerd → doorgaan, het is jouw eigen app. Intrekken kan bij Google (Beveiliging → Apps met toegang) of met Uit de app verwijderen.',
              'VehicleVault can only send mail as the Google account (gmail.send); it cannot read. Google shows a warning that the app is not verified: choose Advanced → continue, it is your own app. Revoke it at Google (Security → Third-party access) or with Remove from the app.'
            )}
          </p>
          <button
            type="button"
            onClick={connectGoogle}
            disabled={busy !== null || !gClientId || !gClientSecret}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
          >
            {busy === 'signin' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            <span>{googleStatus.signedIn ? tr('Opnieuw verbinden met Google', 'Reconnect to Google') : tr('Verbinden met Google', 'Connect to Google')}</span>
          </button>
        </div>
      )}

      {transport === 'smtp' && (
        <>
          <div>
            <span className={`${labelClass} mb-1.5`}>
              {tr('Snelle presets (vult server, poort en versleuteling in)', 'Quick presets (fills server, port and encryption)')}
            </span>
            <div className="flex flex-wrap gap-2">
              {EMAIL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const next = applyEmailPreset(p, { user, from });
                    setHost(next.host);
                    setPort(next.port);
                    setSecure(next.secure);
                    setFrom(next.from);
                    setPreset(p.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-bold transition ${
                    host === p.host && port === p.port
                      ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 text-slate-900 dark:text-white ring-1 ring-purple-500'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {activePreset && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {nl ? activePreset.nl : activePreset.en}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>{tr('SMTP Host / Server *', 'SMTP host / server *')}</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tr('Poort *', 'Port *')}</label>
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 587)}
                className={inputClass}
              />
            </div>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {tr(
                'SSL / TLS directe encryptie (poort 465; uitvinken voor poort 587 STARTTLS)',
                'SSL / TLS direct encryption (port 465; leave off for port 587 STARTTLS)'
              )}
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{tr('Gebruiker / e-mailadres', 'User / email address')}</label>
              <input type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="vault@example.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tr('Wachtwoord / app-wachtwoord', 'Password / app password')}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? tr('Verberg wachtwoord', 'Hide password') : tr('Toon wachtwoord', 'Show password')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>{tr('Afzender (From)', 'Sender (From)')}</label>
            <input type="text" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="VehicleVault <vault@example.com>" className={inputClass} />
          </div>

          <details className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              {tr('Geavanceerd (versleuteling en certificaten)', 'Advanced (encryption and certificates)')}
            </summary>
            <div className="mt-3 space-y-2.5">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireTls}
                  onChange={(e) => setRequireTls(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  <strong>{tr('STARTTLS verplichten', 'Require STARTTLS')}</strong>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {tr('Niet versturen als de server geen versleutelde verbinding aanbiedt (poort 587).', 'Do not send when the server offers no encrypted connection (port 587).')}
                  </span>
                </span>
              </label>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreTlsErrors}
                  onChange={(e) => setIgnoreTlsErrors(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  <strong>{tr('Certificaatfouten negeren', 'Ignore certificate errors')}</strong>
                  <span className="block text-[11px] text-amber-700 dark:text-amber-400">
                    {tr(
                      'Alleen voor een eigen mailserver met een zelfgetekend certificaat. Het verkeer blijft versleuteld, maar de server wordt niet meer gecontroleerd.',
                      'Only for your own mail server with a self-signed certificate. Traffic stays encrypted, but the server is no longer verified.'
                    )}
                  </span>
                </span>
              </label>
            </div>
          </details>
        </>
      )}

      {transport === 'graph' && (
        <>
          <details className="rounded-lg border border-slate-200 dark:border-slate-800 p-3" open={!tenantId}>
            <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              {tr('Zo richt je Microsoft Graph in (eenmalig, in Azure)', 'How to set up Microsoft Graph (once, in Azure)')}
            </summary>
            <ol className="mt-3 list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
              <li>{tr('Open Microsoft Entra ID → App-registraties → Nieuwe registratie (één tenant).', 'Open Microsoft Entra ID → App registrations → New registration (single tenant).')}</li>
              <li>{tr('Kopieer de Application (client) ID en de Directory (tenant) ID uit het overzicht.', 'Copy the Application (client) ID and Directory (tenant) ID from the overview.')}</li>
              <li>{tr('Certificaten en geheimen → Nieuw clientgeheim. Kopieer de waarde (niet de geheim-ID) direct: ze is later niet meer te zien.', 'Certificates & secrets → New client secret. Copy the value (not the secret ID) right away: it cannot be shown again.')}</li>
              <li>{tr('API-machtigingen → Microsoft Graph → Toepassingsmachtigingen → Mail.Send, daarna Beheerderstoestemming verlenen.', 'API permissions → Microsoft Graph → Application permissions → Mail.Send, then Grant admin consent.')}</li>
              <li>{tr('Vul hieronder het adres van de mailbox in waarvandaan verstuurd wordt.', 'Enter the address of the mailbox to send from below.')}</li>
            </ol>
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              {tr(
                'Mail.Send als toepassingsmachtiging geldt voor alle mailboxen in de tenant. Beperk de app met een ApplicationAccessPolicy in Exchange Online tot alleen deze mailbox.',
                'Mail.Send as an application permission covers every mailbox in the tenant. Limit the app to this mailbox with an ApplicationAccessPolicy in Exchange Online.'
              )}
            </p>
          </details>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tenant ID *</label>
              <input type="text" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Client ID *</label>
              <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tr('Client secret *', 'Client secret *')}</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  aria-label={showSecret ? tr('Verberg geheim', 'Hide secret') : tr('Toon geheim', 'Show secret')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>{tr('Afzender-mailbox *', 'Sender mailbox *')}</label>
              <input type="text" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="vehiclevault@contoso.com" className={inputClass} />
            </div>
          </div>
        </>
      )}

      <div>
        <label className={labelClass}>{tr('Ontvanger(s) meldingen (To)', 'Alert recipient(s) (To)')}</label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={tr('beheerder@example.com, partner@example.com', 'admin@example.com, partner@example.com')}
          className={inputClass}
        />
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {tr('Meerdere adressen scheid je met een komma. Leeg = de afzender zelf.', 'Separate several addresses with a comma. Empty = the sender itself.')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={run('save')}
          disabled={busy !== null}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold disabled:opacity-50"
        >
          {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{tr('Opslaan', 'Save')}</span>
        </button>
        <button
          type="button"
          onClick={run('verify')}
          disabled={busy !== null}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {busy === 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          <span>{tr('Verbinding controleren', 'Check connection')}</span>
        </button>
        <button
          type="button"
          onClick={run('test')}
          disabled={busy !== null}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-50 dark:hover:bg-purple-950/40 disabled:opacity-50"
        >
          {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>{tr('Testmail versturen', 'Send test mail')}</span>
        </button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center space-x-1">
          <Mail className="w-3 h-3" />
          <span>{tr('Controleren en testen slaan eerst op.', 'Checking and testing save first.')}</span>
        </span>
      </div>

      {result && (
        <div
          role="status"
          className={`flex items-start space-x-2 p-3 rounded-lg border ${
            result.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
          }`}
        >
          {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span className="leading-relaxed break-words">{result.text}</span>
        </div>
      )}
    </div>
  );
};
