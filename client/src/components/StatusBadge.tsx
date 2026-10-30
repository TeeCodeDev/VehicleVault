import React from 'react';
import { useLanguage } from '../context/LanguageContext.js';

interface StatusBadgeProps {
  status: 'good' | 'warning' | 'overdue' | 'active' | 'archived';
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const { lang } = useLanguage();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  let colorClasses = '';
  let defaultLabel = label;

  switch (status) {
    case 'good':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
      defaultLabel = defaultLabel || (lang === 'nl' ? 'In orde' : 'Good');
      break;
    case 'active':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
      defaultLabel = defaultLabel || (lang === 'nl' ? 'Actief' : 'Active');
      break;
    case 'warning':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50';
      defaultLabel = defaultLabel || (lang === 'nl' ? 'Binnenkort nodig' : 'Due Soon');
      break;
    case 'overdue':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50';
      defaultLabel = defaultLabel || (lang === 'nl' ? 'Verlopen' : 'Overdue');
      break;
    case 'archived':
      colorClasses = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50';
      defaultLabel = defaultLabel || (lang === 'nl' ? 'Gearchiveerd' : 'Archived');
      break;
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-sm whitespace-nowrap shrink-0 ${colorClasses} ${sizeClasses}`}
    >
      {defaultLabel}
    </span>
  );
};
