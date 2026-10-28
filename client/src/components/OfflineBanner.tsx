import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';
import { getOfflineFuelQueue, syncOfflineQueue } from '../utils/offlineQueue.js';

export const OfflineBanner: React.FC = () => {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState(false);

  const updateStatus = () => {
    setIsOnline(navigator.onLine);
    const queue = getOfflineFuelQueue();
    setQueueCount(queue.length);
  };

  useEffect(() => {
    updateStatus();

    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    const handleQueueChange = (e: any) => {
      setQueueCount(e.detail?.count ?? getOfflineFuelQueue().length);
    };
    const handleSynced = () => {
      updateStatus();
      setSyncSuccessMsg(true);
      setTimeout(() => setSyncSuccessMsg(false), 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('vv_offline_queue_changed', handleQueueChange);
    window.addEventListener('vv_offline_synced', handleSynced);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('vv_offline_queue_changed', handleQueueChange);
      window.removeEventListener('vv_offline_synced', handleSynced);
    };
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineQueue();
      if (res.syncedCount > 0) {
        setSyncSuccessMsg(true);
        setTimeout(() => setSyncSuccessMsg(false), 4000);
      }
    } finally {
      setSyncing(false);
      updateStatus();
    }
  };

  if (isOnline && queueCount === 0 && !syncSuccessMsg) {
    return null;
  }

  return (
    <div className="bg-slate-900 text-white dark:bg-slate-800 border-b border-slate-700/60 px-4 py-2 text-xs font-semibold flex items-center justify-between transition shadow-inner">
      <div className="flex items-center space-x-2.5">
        {!isOnline ? (
          <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <WifiOff className="w-3.5 h-3.5" />
          </div>
        ) : syncSuccessMsg ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <RefreshCw className="w-3.5 h-3.5" />
          </div>
        )}

        <span>
          {!isOnline
            ? t('offlineBanner')
            : syncSuccessMsg
            ? t('syncedSuccessfully')
            : t('offlineQueueCount', { count: queueCount })}
        </span>
      </div>

      {isOnline && queueCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1.5 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? t('syncing') : t('syncNow')}</span>
        </button>
      )}
    </div>
  );
};

