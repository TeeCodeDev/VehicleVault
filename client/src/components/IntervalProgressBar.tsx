import React from 'react';
import { MaintenanceInterval } from '../types/index.js';
import { useLanguage } from '../context/LanguageContext.js';

interface IntervalProgressBarProps {
  interval: MaintenanceInterval;
}

export const IntervalProgressBar: React.FC<IntervalProgressBarProps> = ({ interval }) => {
  const { t, translateCategory } = useLanguage();
  const percent = Math.min(100, Math.max(0, interval.percentUsed));

  let barColor = 'bg-emerald-500';
  let badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800/40 dark:bg-emerald-950/40';

  if (interval.status === 'overdue') {
    barColor = 'bg-rose-500';
    badgeColor = 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:border-rose-800/40 dark:bg-rose-950/40';
  } else if (interval.status === 'warning') {
    barColor = 'bg-amber-500';
    badgeColor = 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:border-amber-800/40 dark:bg-amber-950/40';
  }

  const rawName = interval.customName || interval.categoryName;
  const displayName = translateCategory(rawName);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {displayName}
        </span>
        <div className="flex items-center space-x-2">
          {interval.triggerReason !== 'none' && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {interval.triggerReason === 'distance' ? t('kmTrigger') : t('timeTrigger')}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${badgeColor}`}>
            {interval.percentUsed}%
          </span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
        <div
          className={`h-full transition-all duration-500 rounded-full ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Metric details with i18n */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
        <span>
          {interval.kmRemaining !== null ? (
            interval.kmRemaining <= 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                {t('kmOverdue', { km: Math.abs(interval.kmRemaining).toLocaleString() })}
              </span>
            ) : (
              t('kmRemaining', { km: interval.kmRemaining.toLocaleString() })
            )
          ) : (
            t('noKmLimit')
          )}
        </span>
        <span>
          {interval.daysRemaining !== null ? (
            interval.daysRemaining <= 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                {t('daysOverdue', { days: Math.abs(interval.daysRemaining) })}
              </span>
            ) : (
              t('daysRemaining', { days: interval.daysRemaining })
            )
          ) : (
            t('noTimeLimit')
          )}
        </span>
      </div>
    </div>
  );
};
