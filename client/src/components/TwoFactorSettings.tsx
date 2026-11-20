import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Copy,
  Check,
  Download,
  Loader2,
  AlertCircle,
  KeyRound,
  Trash2,
  RefreshCw,
  X,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesCount: number;
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export const TwoFactorSettings: React.FC = () => {
  const { t } = useLanguage();
  const { authDisabled } = useAuth();

  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Setup modal state
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable modal state
  const [isDisableOpen, setIsDisableOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmCode, setConfirmCode] = useState('');

  // Backup codes modal
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<TwoFactorStatus>('/api/auth/2fa/status');
      setStatus(res);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (authDisabled) return null;

  const startSetup = async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await apiFetch<TwoFactorSetup>('/api/auth/2fa/setup', { method: 'POST' });
      setSetupData(res);
      setVerifyCode('');
      setIsSetupOpen(true);
    } catch (err: any) {
      setError(err?.message || t('twoFactorInitFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setError(null);
    setBusy(true);

    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      setIsSetupOpen(false);
      setSetupData(null);
      setSuccess(res.message || t('twoFactorEnabledSuccess'));
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || t('twoFactorInvalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({
          password: confirmPassword || undefined,
          code: confirmCode || undefined,
        }),
      });
      setIsDisableOpen(false);
      setConfirmPassword('');
      setConfirmCode('');
      setSuccess(res.message || t('twoFactorDisabledSuccess'));
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || t('twoFactorDisableFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateCodes = async () => {
    const pwd = prompt(t('twoFactorRegeneratePrompt'));
    if (!pwd) return;

    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ backupCodes: string[]; message: string }>(
        '/api/auth/2fa/backup-codes',
        {
          method: 'POST',
          body: JSON.stringify({ password: pwd }),
        }
      );
      setNewBackupCodes(res.backupCodes);
      setSuccess(res.message);
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || t('twoFactorRegenerateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'codes') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const downloadCodes = (codes: string[]) => {
    const content = t('twoFactorCodesFile', { date: new Date().toLocaleString(), codes: codes.join('\n') });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehiclevault-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-center text-xs text-slate-400">
        {t('twoFactorStatusLoading')}
      </div>
    );
  }

  const isEnabled = Boolean(status?.enabled);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-accent-500" />
            <span>{t('twoFactorSettingsTitle')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('twoFactorSettingsHint')}
          </p>
        </div>

        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center space-x-1.5 self-start sm:self-center ${
            isEnabled
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
          }`}
        >
          {isEnabled ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          <span>{isEnabled ? t('twoFactorEnabledBadge') : t('twoFactorDisabledBadge')}</span>
        </span>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs p-3 rounded-xl font-medium">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Body content */}
      {!isEnabled ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              {t('twoFactorPromoTitle')}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block max-w-xl">
              {t('twoFactorPromoHint')}
            </span>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={startSetup}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center space-x-2 self-start sm:self-auto shrink-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            <span>{t('enableTwoFactor')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('twoFactorProtected')}</span>
              </span>
              <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">
                {t('twoFactorCodesAvailable', { count: status?.backupCodesCount || 0 })}
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleRegenerateCodes}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('newRecoveryCodes')}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setIsDisableOpen(true);
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('disableTwoFactor')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup Modal */}
      {isSetupOpen && setupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <QrCode className="w-4 h-4 text-accent-500" />
                <span>{t('twoFactorSetupTitle')}</span>
              </h3>
              <button
                onClick={() => setIsSetupOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Stap 1: QR Code */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {t('twoFactorStepScan')}
                </span>
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                  <img src={setupData.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 object-contain" />
                  <div className="mt-2 text-center">
                    <span className="text-[10px] text-slate-500 block">{t('twoFactorManualKey')}</span>
                    <div className="flex items-center justify-center space-x-1 mt-0.5">
                      <code className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded select-all">
                        {setupData.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(setupData.secret, 'secret')}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600 transition"
                        title={t('twoFactorCopyKey')}
                      >
                        {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stap 2: Noodherstelcodes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    {t('twoFactorStepCodes')}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(setupData.backupCodes.join('\n'), 'codes')}
                      className="text-[11px] font-bold text-accent-600 hover:text-accent-700 flex items-center space-x-1"
                    >
                      {copiedCodes ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCodes ? t('copied') : t('copy')}</span>
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => downloadCodes(setupData.backupCodes)}
                      className="text-[11px] font-bold text-accent-600 hover:text-accent-700 flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>{t('download')}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center select-all">
                  {setupData.backupCodes.map((code, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 py-1 rounded border border-slate-200/60 dark:border-slate-800">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stap 3: Bevestigen met 6 cijfers */}
              <form onSubmit={handleEnable} className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  {t('twoFactorStepVerify')}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="123456"
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-center text-sm font-bold tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-accent-500 shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || !verifyCode.trim()}
                    className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white font-bold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5 shrink-0"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{t('twoFactorActivate')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {isDisableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>{t('disableTwoFactor')}</span>
              </h3>
              <button
                onClick={() => setIsDisableOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('twoFactorDisableHint')}
            </p>

            <form onSubmit={handleDisable} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('passwordLabel')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="text-center text-[10px] uppercase font-bold text-slate-400">{t('orDivider')}</div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t('sixDigitCode')}
                </label>
                <input
                  type="text"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-center text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisableOpen(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || (!confirmPassword && !confirmCode)}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('twoFactorDisableConfirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Backup Codes Display Modal */}
      {newBackupCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-emerald-500" />
                <span>{t('newBackupCodesTitle')}</span>
              </h3>
              <button
                onClick={() => setNewBackupCodes(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {t('newBackupCodesHint')}
            </p>

            <div className="grid grid-cols-2 gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center select-all">
              {newBackupCodes.map((code, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 py-1 rounded border border-slate-200/60 dark:border-slate-800">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => copyToClipboard(newBackupCodes.join('\n'), 'codes')}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
              >
                {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCodes ? t('copied') : t('copy')}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadCodes(newBackupCodes)}
                className="flex-1 py-2 bg-accent-600 hover:bg-accent-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('download')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

