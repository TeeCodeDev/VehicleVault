import React, { useEffect, useState } from 'react';
import {
  Radio,
  X,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  Gauge,
} from 'lucide-react';
import { apiFetch } from '../../api/client.js';
import { useLanguage } from '../../context/LanguageContext.js';

export interface TelematicsSyncLogItem {
  id: string;
  vehicle_id: string;
  entity_id: string | null;
  status: 'success' | 'warning' | 'error';
  odometer: number | null;
  previous_odometer: number | null;
  odometer_changed: number;
  message: string | null;
  trigger_source: 'manual' | 'scheduler';
  created_at: string;
}

interface TelematicsSyncLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  vehicleName: string;
  onSyncCompleted?: (newOdo?: number) => void;
}

export const TelematicsSyncLogModal: React.FC<TelematicsSyncLogModalProps> = ({
  isOpen,
  onClose,
  vehicleId,
  vehicleName,
  onSyncCompleted,
}) => {
  const { lang, t } = useLanguage();
  const [logs, setLogs] = useState<TelematicsSyncLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchLogs = async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ logs: TelematicsSyncLogItem[] }>(`/api/telematics/logs/${vehicleId}`);
      setLogs(res.logs || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && vehicleId) {
      setFeedback(null);
      fetchLogs();
    }
  }, [isOpen, vehicleId]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ success: boolean; odometer?: number; updated?: boolean; error?: string }>(
        `/api/telematics/sync/${vehicleId}`,
        { method: 'POST' }
      );
      if (res.success) {
        setFeedback({
          type: 'ok',
          text: t('telematicsSyncSuccess', { km: (res.odometer || 0).toLocaleString() }),
        });
        if (onSyncCompleted) onSyncCompleted(res.odometer);
      } else {
        setFeedback({
          type: 'err',
          text: res.error || t('telematicsSyncFailed'),
        });
      }
      await fetchLogs();
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || t('telematicsSyncFailed'),
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm(t('confirmClearSyncLog'))) {
      return;
    }
    try {
      await apiFetch(`/api/telematics/logs/${vehicleId}`, { method: 'DELETE' });
      setLogs([]);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('syncLogTitle')}
              </h3>
              <p className="text-xs text-slate-400 font-medium">{vehicleName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{syncing ? t('syncLogFetching') : t('syncLogSyncNow')}</span>
            </button>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
              title={t('syncLogRefresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('syncLogClear')}</span>
            </button>
          )}
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
        )}

        {/* Logs list */}
        <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
          {loading && logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span>{t('syncLogLoading')}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                {t('syncLogEmpty')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {t('syncLogEmptyHint')}
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {log.status === 'success' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t('syncLogSuccess')}</span>
                      </span>
                    ) : log.status === 'warning' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{t('syncLogWarning')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                        <XCircle className="w-3 h-3" />
                        <span>{t('syncLogError')}</span>
                      </span>
                    )}

                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {log.trigger_source === 'scheduler'
                        ? t('syncLogScheduler')
                        : t('syncLogManual')}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(log.created_at).toLocaleString(lang, {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-slate-700 dark:text-slate-300 font-medium">
                  <span className="font-mono text-[11px] text-slate-500">{log.entity_id || '—'}</span>
                  {log.odometer !== null && (
                    <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center space-x-1">
                      <Gauge className="w-3 h-3 text-sky-500" />
                      <span>{log.odometer.toLocaleString()} km</span>
                    </span>
                  )}
                </div>

                {log.message && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg font-mono">
                    {log.message}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
