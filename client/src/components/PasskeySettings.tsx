import React, { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Plus, Trash2, Pencil, Copy, Check, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { PasskeyItem } from '../types/index.js';
import { passkeyErrorMessage, registerPasskey } from '../utils/passkeys.js';

interface PasskeyList {
  passkeys: PasskeyItem[];
  recoveryCodesRemaining: number;
  hasPassword: boolean;
}

export const PasskeySettings: React.FC = () => {
  const { lang } = useLanguage();
  const { passkeyAvailable, passkeyUnavailableReason, authDisabled } = useAuth();
  const nl = lang === 'nl';

  const [data, setData] = useState<PasskeyList | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<PasskeyList>('/api/auth/passkeys'));
    } catch {
      // Signed in through the proxy, an API key or with login switched off: nothing to manage here.
      setData(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (authDisabled || !data) return null;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err: any) {
      setError(passkeyErrorMessage(err, lang));
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await registerPasskey(label.trim());
      setLabel('');
      if (res.recoveryCodes) setCodes(res.recoveryCodes);
      await load();
    });
  };

  const handleRename = (p: PasskeyItem) => {
    const next = prompt(nl ? 'Nieuwe naam voor deze passkey' : 'New name for this passkey', p.label);
    if (!next || next.trim() === p.label) return;
    run(async () => {
      await apiFetch(`/api/auth/passkeys/${encodeURIComponent(p.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: next.trim() }),
      });
      await load();
    });
  };

  const handleDelete = (p: PasskeyItem) => {
    if (!confirm(nl ? `Passkey "${p.label}" verwijderen?` : `Remove passkey "${p.label}"?`)) return;
    run(async () => {
      await apiFetch(`/api/auth/passkeys/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      await load();
    });
  };

  const handleRegenerate = () => {
    if (!confirm(nl ? 'Nieuwe herstelcodes maken? De oude codes werken dan niet meer.' : 'Create new recovery codes? The old ones will stop working.')) return;
    run(async () => {
      const res = await apiFetch<{ recoveryCodes: string[] }>('/api/auth/passkeys/recovery-codes', { method: 'POST' });
      setCodes(res.recoveryCodes);
      await load();
    });
  };

  const copyCodes = () => {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(nl ? 'nl-NL' : 'en-GB') : null);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
        <Fingerprint className="w-4 h-4 text-sky-500" />
        <span>{nl ? 'Passkeys' : 'Passkeys'}</span>
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {nl
          ? 'Log in met vingerafdruk, gezicht of apparaatcode in plaats van een wachtwoord. Je wachtwoord blijft werken.'
          : 'Sign in with a fingerprint, face or device PIN instead of a password. Your password keeps working.'}
      </p>

      {error && (
        <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {codes && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
            {nl ? 'Bewaar deze herstelcodes nu. Ze worden maar één keer getoond.' : 'Save these recovery codes now. They are shown only once.'}
          </span>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-xs text-slate-900 dark:text-white">
            {codes.map((c) => (
              <li key={c} className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-1.5">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={copyCodes}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (nl ? 'Gekopieerd' : 'Copied') : nl ? 'Kopiëren' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCodes(null)}
              className="px-3 py-1.5 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 rounded-lg text-xs font-bold transition"
            >
              {nl ? 'Ik heb ze bewaard' : "I've saved them"}
            </button>
          </div>
        </div>
      )}

      {!passkeyAvailable && passkeyUnavailableReason && (
        <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3">
          {passkeyUnavailableReason}
        </p>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          maxLength={50}
          placeholder={nl ? 'Naam (bijv. Telefoon, Laptop)' : 'Name (e.g. Phone, Laptop)'}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={busy || !passkeyAvailable}
          className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{nl ? 'Passkey toevoegen' : 'Add passkey'}</span>
        </button>
      </form>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {data.passkeys.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">{nl ? 'Nog geen passkeys toegevoegd.' : 'No passkeys added yet.'}</p>
        ) : (
          data.passkeys.map((p) => (
            <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">{p.label}</span>
                <span className="text-slate-400 text-[11px]">
                  {nl ? 'Toegevoegd' : 'Added'} {formatDate(p.createdAt)}
                  {p.lastUsedAt ? ` · ${nl ? 'laatst gebruikt' : 'last used'} ${formatDate(p.lastUsedAt)}` : ''}
                  {p.backedUp ? ` · ${nl ? 'gesynchroniseerd' : 'synced'}` : ''}
                </span>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleRename(p)}
                  disabled={busy}
                  aria-label={nl ? 'Naam wijzigen' : 'Rename'}
                  className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  disabled={busy}
                  aria-label={nl ? 'Verwijderen' : 'Remove'}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {data.passkeys.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs">
          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {nl
                ? `Herstelcodes: ${data.recoveryCodesRemaining} over`
                : `Recovery codes: ${data.recoveryCodesRemaining} left`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={busy}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold transition disabled:opacity-50"
          >
            {nl ? 'Nieuwe codes maken' : 'Create new codes'}
          </button>
        </div>
      )}
    </div>
  );
};
