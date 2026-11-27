import React from 'react';
import { CalendarClock, CheckCircle2, TrendingUp, Layers } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.js';
import { RecurringExpense } from '../../types/index.js';

interface ExpenseSummaryCardsProps {
  monthlyTotal: number;
  yearlyTotal: number;
  activeExpenses: RecurringExpense[];
  inactiveExpenses: RecurringExpense[];
  highestExpense: { name: string; monthly: number; category: string } | null;
  uniqueCategoriesCount: number;
  totalExpensesCount: number;
}

export const ExpenseSummaryCards: React.FC<ExpenseSummaryCardsProps> = ({
  monthlyTotal,
  yearlyTotal,
  activeExpenses,
  inactiveExpenses,
  highestExpense,
  uniqueCategoriesCount,
  totalExpensesCount,
}) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* KPI 1: Maandlasten */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('expenseMonthlyCost')}
          </span>
          <div className="w-7 h-7 rounded-lg bg-accent-50 dark:bg-accent-100/10 text-accent-600 dark:text-accent-400 flex items-center justify-center">
            <CalendarClock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">
          € {monthlyTotal.toFixed(2)}{' '}
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t('expensePerMonthShort')}</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 font-mono">
          {t('expenseAmountPerYear', { amount: yearlyTotal.toFixed(2) })}
        </div>
      </div>

      {/* KPI 2: Actieve Posten */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('expenseActiveItems')}
          </span>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
          {activeExpenses.length}{' '}
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            {t('expenseOfTotal', { total: totalExpensesCount })}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          {inactiveExpenses.length > 0
            ? t('expensePausedCount', { count: inactiveExpenses.length })
            : t('expenseAllActive')}
        </div>
      </div>

      {/* KPI 3: Grootste Kostenpost */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('expenseLargest')}
          </span>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono truncate">
          {highestExpense ? (
            <>
              € {highestExpense.monthly.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t('expensePerMonthShort')}</span>
            </>
          ) : (
            '—'
          )}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          {highestExpense ? highestExpense.name : t('expenseNoActive')}
        </div>
      </div>

      {/* KPI 4: Categorieën */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('expenseCategories')}
          </span>
          <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
          {uniqueCategoriesCount}{' '}
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            {t('expenseActiveLower')}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          {t('expenseCategoriesHint')}
        </div>
      </div>
    </div>
  );
};

