import React, { useEffect, useState } from 'react';
import {
  Clock,
  Download,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, getAuthToken } from '../../api/client.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { formatDisplayDate } from '../../utils/format.js';

interface StoredBackup {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
}

interface AutoBackupConfig {
  enabled: boolean;
  intervalHours: number;
  retention: number;
  lastRunAt: string | null;
}

interface AutoBackupCardProps {
  onRestored?: () => void;
}

export const AutoBackupCard: React.FC<AutoBackupCardProps> = ({ onRestored }) => {
  const { t } = useLanguage();
  const [config, setConfig] = useState<AutoBackupConfig>({
    enabled: false,
    intervalHours: 24,
    retention: 7,
    lastRunAt: null,
  });
  const [backups, setBackups] = useState<StoredBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ config: AutoBackupConfig; backups: StoredBackup[] }>(
        '/api/backup/schedule'
      );
      setConfig(data.config);
      setBackups(data.backups || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const data = await apiFetch<{ config: AutoBackupConfig }>('/api/backup/schedule', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: config.enabled,
          intervalHours: config.intervalHours,
          retention: config.retention,
        }),
      });
      setConfig(data.config);
      setFeedback({ type: 'success', text: t('autoBackupSaved') });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || t('backupRestoreFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setFeedback(null);
    try {
      const data = await apiFetch<{ config: AutoBackupConfig; backups: StoredBackup[] }>(
        '/api/backup/run-now',
        { method: 'POST' }
      );
      setConfig(data.config);
      setBackups(data.backups || []);
      setFeedback({ type: 'success', text: t('autoBackupCreated') });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || t('backupDownloadFailed') });
    } finally {
      setRunning(false);
    }
  };

  const handleDownloadStored = async (filename: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/backup/stored/${encodeURIComponent(filename)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(t('backupDownloadFailed'));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || t('backupDownloadFailed') });
    }
  };

  const handleRestoreStored = async (filename: string) => {
    if (!confirm(t('confirmRestoreBackup', { file: filename }))) return;
    setBusyFile(filename);
    setFeedback(null);
    try {
      const data = await apiFetch<{ message?: string }>(
        `/api/backup/stored/${encodeURIComponent(filename)}/restore`,
        { method: 'POST' }
      );
      setFeedback({ type: 'success', text: data.message || t('backupRestored') });
      onRestored?.();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || t('backupRestoreFailed') });
    } finally {
      setBusyFile(null);
    }
  };

  const handleDeleteStored = async (filename: string) => {
    if (!confirm(t('autoBackupConfirmDelete', { file: filename }))) return;
    setBusyFile(filename);
    setFeedback(null);
    try {
      const data = await apiFetch<{ backups: StoredBackup[] }>(
        `/api/backup/stored/${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );
      setBackups(data.backups || []);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || t('backupRestoreFailed') });
    } finally {
      setBusyFile(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-sky-500" />
            <span>{t('autoBackupTitle')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('autoBackupSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunNow}
          disabled={running || loading}
          className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition disabled:opacity-50 shrink-0"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          <span>{running ? t('autoBackupRunning') : t('autoBackupRunNow')}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-xs">
        <label className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {t('autoBackupEnabledLabel')}
          </span>
        </label>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t('autoBackupIntervalLabel')}
          </label>
          <select
            value={config.intervalHours}
            onChange={(e) => setConfig((prev) => ({ ...prev, intervalHours: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value={12}>{t('autoBackupInterval12h')}</option>
            <option value={24}>{t('autoBackupInterval24h')}</option>
            <option value={168}>{t('autoBackupInterval7d')}</option>
          </select>
        </div>

        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('autoBackupRetentionLabel')}
            </label>
            <select
              value={config.retention}
              onChange={(e) => setConfig((prev) => ({ ...prev, retention: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              {[3, 7, 14, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-black dark:hover:bg-white rounded-xl font-bold inline-flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{t('autoBackupSave')}</span>
          </button>
        </div>
      </form>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {config.lastRunAt
          ? t('autoBackupLastRun', { date: formatDisplayDate(config.lastRunAt) })
          : t('autoBackupNeverRun')}
      </p>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2.5">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
          {t('autoBackupListTitle')} ({backups.length})
        </h3>
        {backups.length === 0 ? (
          <p className="text-xs text-slate-400 italic">{t('autoBackupEmpty')}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-950/40 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {b.filename}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {formatDisplayDate(b.createdAt)} • {b.sizeFormatted}
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyFile === b.filename}
                    onClick={() => handleRestoreStored(b.filename)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-semibold inline-flex items-center space-x-1 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('autoBackupRestoreBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadStored(b.filename)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition"
                    title={t('downloadFullBackup')}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busyFile === b.filename}
                    onClick={() => handleDeleteStored(b.filename)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title={t('delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
