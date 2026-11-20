import React, { useState, useEffect } from 'react';
import { Radio, Check, AlertCircle, Loader2, RefreshCw, Server, Key, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../api/client.js';
import { useLanguage } from '../../context/LanguageContext.js';

export const HomeAssistantTelematicsCard: React.FC = () => {
  const { t } = useLanguage();
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    apiFetch<{ configured: boolean; ha_base_url: string; has_token: boolean }>('/api/telematics/config')
      .then((res) => {
        setBaseUrl(res.ha_base_url || '');
        setHasToken(res.has_token || false);
        setConfigured(res.configured || false);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await apiFetch('/api/telematics/config', {
        method: 'POST',
        body: JSON.stringify({
          ha_base_url: baseUrl,
          ha_access_token: token || undefined,
        }),
      });

      if (token) {
        setHasToken(true);
        setToken('');
      }
      setConfigured(Boolean(baseUrl));
      setMessage({
        type: 'success',
        text: t('haSettingsSaved'),
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || t('haSettingsSaveFailed'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await apiFetch<{ success: boolean; message: string; haVersion?: string }>('/api/telematics/test', {
        method: 'POST',
      });

      if (res.success) {
        setMessage({
          type: 'success',
          text: `${res.message} ${res.haVersion ? `(HA v${res.haVersion})` : ''}`,
        });
      } else {
        setMessage({
          type: 'error',
          text: res.message || t('haConnectionTestFailed'),
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || t('haConnectionTestFailed'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setMessage(null);

    try {
      const res = await apiFetch<{ total: number; synced: number; errors: number }>('/api/telematics/sync-all', {
        method: 'POST',
      });

      setMessage({
        type: 'success',
        text: t('haSyncAllResult', { synced: res.synced, total: res.total, errors: res.errors }),
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || t('telematicsSyncFailed'),
      });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>{t('haTelematicsTitle')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('haTelematicsHint')}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {configured && (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{t('haConfigured')}</span>
            </span>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center space-x-2 font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
            {t('haServerUrlLabel')}
          </label>
          <div className="relative">
            <Server className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('haServerUrlPlaceholder')}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-mono text-xs"
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {t('haServerUrlHint')}
          </p>
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
            {t('haAccessTokenLabel')}
          </label>
          <div className="relative">
            <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={hasToken ? t('haTokenSavedPlaceholder') : t('haTokenPlaceholder')}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-mono text-xs"
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {t('haAccessTokenHint')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="submit"
            disabled={loading || !baseUrl.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center space-x-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{loading ? t('saving') : t('haSaveSettings')}</span>
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !baseUrl.trim() || (!hasToken && !token.trim())}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{testing ? t('haTesting') : t('haTestConnection')}</span>
          </button>

          {configured && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="px-3.5 py-2 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 rounded-xl font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{syncingAll ? t('syncing') : t('haSyncAllVehicles')}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

