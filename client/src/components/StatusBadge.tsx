import React from 'react';

interface StatusBadgeProps {
  status: 'good' | 'warning' | 'overdue' | 'active' | 'archived';
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  let colorClasses = '';
  let defaultLabel = label;

  switch (status) {
    case 'good':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
      defaultLabel = defaultLabel || 'In orde';
      break;
    case 'active':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
      defaultLabel = defaultLabel || 'Actief';
      break;
    case 'warning':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50';
      defaultLabel = defaultLabel || 'Binnenkort nodig';
      break;
    case 'overdue':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50';
      defaultLabel = defaultLabel || 'Verlopen';
      break;
    case 'archived':
      colorClasses = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50';
      defaultLabel = defaultLabel || 'Gearchiveerd';
      break;
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-sm ${colorClasses} ${sizeClasses}`}
    >
      {defaultLabel}
    </span>
  );
};
