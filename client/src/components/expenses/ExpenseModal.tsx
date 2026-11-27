import React from 'react';
import { X, AlertCircle, Sparkles } from 'lucide-react';
import { RecurringExpense } from '../../types/index.js';
import { DatePicker } from '../DatePicker.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { EXPENSE_CATEGORY_LABEL_KEYS, EXPENSE_FREQUENCY_LABEL_KEYS } from './expenseLabels.js';

const CATEGORY_OPTIONS: { value: RecurringExpense['category']; icon: string }[] = [
  { value: 'tax', icon: '🏛️' },
  { value: 'insurance', icon: '🛡️' },
  { value: 'roadside', icon: '🛟' },
  { value: 'subscription', icon: '📱' },
  { value: 'lease', icon: '📝' },
  { value: 'inspection', icon: '🔍' },
  { value: 'other', icon: '🏷️' },
];

const FREQUENCY_OPTIONS: RecurringExpense['frequency'][] = ['monthly', 'quarterly', 'yearly'];

export interface PresetOption {
  label: string;
  name: string;
  category: RecurringExpense['category'];
  frequency: RecurringExpense['frequency'];
  icon: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  editingExpense: RecurringExpense | null;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  presets: PresetOption[];
  onApplyPreset: (p: PresetOption) => void;
  name: string;
  setName: (v: string) => void;
  category: RecurringExpense['category'];
  setCategory: (v: RecurringExpense['category']) => void;
  frequency: RecurringExpense['frequency'];
  setFrequency: (v: RecurringExpense['frequency']) => void;
  amount: string;
  setAmount: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  notes: string;
  setNotes: (v: string) => void;
  modalError: string | null;
  saving: boolean;
  calculatedMonthly: number | null;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  editingExpense,
  onClose,
  onSave,
  presets,
  onApplyPreset,
  name,
  setName,
  category,
  setCategory,
  frequency,
  setFrequency,
  amount,
  setAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isActive,
  setIsActive,
  notes,
  setNotes,
  modalError,
  saving,
  calculatedMonthly,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {editingExpense ? t('expenseEditTitle') : t('expenseNewTitle')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {modalError && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        {!editingExpense && (
          <div className="mb-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent-500" />
              <span>{t('expenseSelectTemplate')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onApplyPreset(p)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-accent-50 hover:text-accent-600 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center space-x-1 transition"
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={onSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {t('expenseDescriptionRequired')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('examplePlaceholder', { value: t('expensePresetTaxName') })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('expenseCategory')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {t(EXPENSE_CATEGORY_LABEL_KEYS[opt.value])}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('expenseFrequency')}
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                {FREQUENCY_OPTIONS.map((freq) => (
                  <option key={freq} value={freq}>
                    {t(EXPENSE_FREQUENCY_LABEL_KEYS[freq])}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {t('expenseGrossAmountRequired')}
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('examplePlaceholder', { value: '65.00' })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            {calculatedMonthly !== null && (
              <p className="text-[11px] text-accent-600 dark:text-accent-400 font-bold mt-1">
                {t('expenseApproxPerMonth', { amount: calculatedMonthly.toFixed(2) })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <DatePicker label={t('expenseStartDateRequired')} value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <DatePicker label={t('expenseEndDateOptional')} value={endDate} onChange={setEndDate} />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {t('expenseNotesOptional')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('expenseNotesPlaceholder')}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-accent-600 focus:ring-accent-500"
            />
            <label htmlFor="isActiveCheck" className="text-slate-700 dark:text-slate-300 font-semibold">
              {t('expenseIsActive')}
            </label>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-bold transition shadow-sm disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

