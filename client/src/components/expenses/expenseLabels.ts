import { RecurringExpense } from '../../types/index.js';
import type { TranslationKey } from '../../i18n/translations.js';

export const EXPENSE_CATEGORY_LABEL_KEYS: Record<RecurringExpense['category'], TranslationKey> = {
  tax: 'expenseCatTax',
  insurance: 'expenseCatInsurance',
  roadside: 'expenseCatRoadside',
  subscription: 'expenseCatSubscription',
  lease: 'expenseCatLease',
  inspection: 'expenseCatInspection',
  other: 'expenseCatOther',
};

export const EXPENSE_FREQUENCY_LABEL_KEYS: Record<RecurringExpense['frequency'], TranslationKey> = {
  monthly: 'expenseFreqMonthly',
  quarterly: 'expenseFreqQuarterly',
  yearly: 'expenseFreqYearly',
};
