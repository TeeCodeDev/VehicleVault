import type { expenses as nl } from '../nl/expenses.js';

export const expenses: Record<keyof typeof nl, string> = {
  // Fixed expenses page
  expensesNoVehicleHint: 'Select a vehicle from the top selector to manage its recurring expenses.',
  expensesSubtitle: '{vehicle} ({plate}) • Manage recurring vehicle taxes, insurance policies, and subscriptions.',
  expensesNoPlate: 'No license plate',
  expensesViewInTco: 'View in TCO',
  expensesAdd: 'Add Fixed Expense',
  expensesSearchPlaceholder: 'Search by description or notes...',
  expensesAllCategories: 'All Categories',
  expensesLoading: 'Loading recurring expenses...',
  expensesEmptyTitle: 'No recurring expenses configured',
  expensesEmptyHint: 'Add recurring costs like road tax (MRB), auto insurance, roadside assistance, or subscriptions.',
  expensesLoadFailed: 'Could not load recurring expenses',
  expenseValidation: 'Name, a valid positive amount (> € 0) and start date are required.',
  expenseSaveFailed: 'Error saving recurring expense',
  expenseStatusUpdateFailed: 'Could not update status',
  expenseDeleteFailed: 'Could not delete recurring expense',
  expenseDeleteTitle: 'Delete Fixed Expense?',
  expenseDeleteConfirm: 'Are you sure you want to delete "{name}"? This cannot be undone.',
  expensePaused: 'Paused',

  // Categories
  expenseCatTax: 'Road Tax (MRB)',
  expenseCatInsurance: 'Car Insurance',
  expenseCatRoadside: 'Roadside Assistance',
  expenseCatSubscription: 'Subscription',
  expenseCatLease: 'Lease / Financing',
  expenseCatInspection: 'Inspection / MOT',
  expenseCatOther: 'Other',

  // Frequencies
  expenseFreqMonthly: 'Monthly',
  expenseFreqQuarterly: 'Quarterly',
  expenseFreqYearly: 'Yearly',

  // Templates
  expensePresetTaxLabel: 'Road Tax (MRB)',
  expensePresetTaxName: 'Road Tax (MRB)',
  expensePresetInsuranceLabel: 'Car Insurance',
  expensePresetInsuranceName: 'Car Insurance (Comprehensive / Third Party)',
  expensePresetRoadsideLabel: 'ANWB Roadside Assistance',
  expensePresetRoadsideName: 'ANWB Wegenwacht Europa',
  expensePresetSubscriptionLabel: 'Flitsmeister PRO',
  expensePresetSubscriptionName: 'Flitsmeister PRO Subscription',
  expensePresetLeaseLabel: 'Private Lease',
  expensePresetLeaseName: 'Private Lease Monthly Payment',

  // Expense modal
  expenseEditTitle: 'Edit Recurring Expense',
  expenseNewTitle: 'Add Recurring Expense',
  expenseSelectTemplate: 'Select a template',
  expenseDescriptionRequired: 'Description *',
  expenseCategory: 'Category',
  expenseFrequency: 'Frequency',
  expenseGrossAmountRequired: 'Gross Amount (€) *',
  expenseApproxPerMonth: '≈ € {amount} per month',
  expenseStartDateRequired: 'Start Date *',
  expenseEndDateOptional: 'End Date (optional)',
  expenseNotesOptional: 'Notes (optional)',
  expenseNotesPlaceholder: 'Policy number, coverage...',
  expenseIsActive: 'This expense is currently active',

  // Summary cards
  expenseMonthlyCost: 'Monthly Cost',
  expensePerMonthShort: '/ mo',
  expenseAmountPerYear: '€ {amount} per year',
  expenseActiveItems: 'Active Items',
  expenseOfTotal: 'of {total}',
  expensePausedCount: '{count} paused',
  expenseAllActive: 'All registered items active',
  expenseLargest: 'Largest Expense',
  expenseNoActive: 'No active items',
  expenseCategories: 'Categories',
  expenseActiveLower: 'active',
  expenseCategoriesHint: 'Tax, insurance, subs',

  // Expense table
  expenseDescription: 'Description',
  expenseGrossAmount: 'Amount',
  expensePerMonth: 'Per Month',
  expenseDuration: 'Duration',
  expenseSince: 'From',
  expenseUntil: 'Until',
  expenseOngoing: 'Ongoing',
};
