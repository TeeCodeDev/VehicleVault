import React from 'react';
import {
  Landmark,
  Shield,
  LifeBuoy,
  Smartphone,
  FileText,
  Search,
  Tag,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { RecurringExpense } from '../../types/index.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { formatDisplayDate } from '../../utils/format.js';
import { EXPENSE_CATEGORY_LABEL_KEYS, EXPENSE_FREQUENCY_LABEL_KEYS } from './expenseLabels.js';

interface ExpenseTableProps {
  expenses: RecurringExpense[];
  onToggleActive: (exp: RecurringExpense) => void;
  onEdit: (exp: RecurringExpense) => void;
  onDeleteRequest: (exp: RecurringExpense) => void;
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses,
  onToggleActive,
  onEdit,
  onDeleteRequest,
}) => {
  const { t } = useLanguage();

  const getCategoryIcon = (cat: RecurringExpense['category']) => {
    switch (cat) {
      case 'tax': return <Landmark className="w-3.5 h-3.5 text-amber-500" />;
      case 'insurance': return <Shield className="w-3.5 h-3.5 text-sky-500" />;
      case 'roadside': return <LifeBuoy className="w-3.5 h-3.5 text-emerald-500" />;
      case 'subscription': return <Smartphone className="w-3.5 h-3.5 text-purple-500" />;
      case 'lease': return <FileText className="w-3.5 h-3.5 text-indigo-500" />;
      case 'inspection': return <Search className="w-3.5 h-3.5 text-teal-500" />;
      default: return <Tag className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getCategoryBadgeClass = (cat: RecurringExpense['category']) => {
    switch (cat) {
      case 'tax':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
      case 'insurance':
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-800/50';
      case 'roadside':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
      case 'subscription':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/50';
      case 'lease':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50';
      case 'inspection':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border-teal-200 dark:border-teal-800/50';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getCategoryLabel = (cat: RecurringExpense['category']) =>
    t(EXPENSE_CATEGORY_LABEL_KEYS[cat] ?? 'expenseCatOther');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              <th className="py-3 px-4">{t('expenseDescription')}</th>
              <th className="py-3 px-3">{t('expenseCategory')}</th>
              <th className="py-3 px-3">{t('expenseFrequency')}</th>
              <th className="py-3 px-3 text-right">{t('expenseGrossAmount')}</th>
              <th className="py-3 px-3 text-right">{t('expensePerMonth')}</th>
              <th className="py-3 px-3">{t('expenseDuration')}</th>
              <th className="py-3 px-3 text-center">{t('status')}</th>
              <th className="py-3 px-4 text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {expenses.map((exp) => {
              const normMonthly =
                exp.frequency === 'monthly'
                  ? exp.amount
                  : exp.frequency === 'quarterly'
                  ? exp.amount / 3
                  : exp.amount / 12;

              return (
                <tr
                  key={exp.id}
                  className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                    !exp.is_active ? 'opacity-60 bg-slate-50/30 dark:bg-slate-950/20' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">{exp.name}</div>
                    {exp.notes && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{exp.notes}</div>
                    )}
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(exp.category)}`}>
                      {getCategoryIcon(exp.category)}
                      <span>{getCategoryLabel(exp.category)}</span>
                    </span>
                  </td>

                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                    {t(EXPENSE_FREQUENCY_LABEL_KEYS[exp.frequency] ?? 'expenseFreqYearly')}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    € {exp.amount.toFixed(2)}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-black text-accent-600 dark:text-accent-400 whitespace-nowrap">
                    € {normMonthly.toFixed(2)}{' '}
                    <span className="text-[10px] font-normal text-slate-400">{t('expensePerMonthShort')}</span>
                  </td>

                  <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    <div>
                      <span className="text-slate-400 font-normal">{t('expenseSince')}: </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDisplayDate(exp.start_date)}</span>
                    </div>
                    {exp.end_date ? (
                      <div className="text-[10px] text-slate-400 mt-0.5">{t('expenseUntil')}: {formatDisplayDate(exp.end_date)}</div>
                    ) : (
                      <div className="text-[10px] text-slate-400 mt-0.5">{t('expenseOngoing')}</div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => onToggleActive(exp)}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition shadow-sm ${
                        exp.is_active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {exp.is_active ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{exp.is_active ? t('active') : t('expensePaused')}</span>
                    </button>
                  </td>

                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center space-x-1">
                      <button
                        onClick={() => onEdit(exp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteRequest(exp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

