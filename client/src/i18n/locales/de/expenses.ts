import type { expenses as nl } from '../nl/expenses.js';

export const expenses: Record<keyof typeof nl, string> = {
  // Fixed expenses page
  expensesNoVehicleHint: 'Wähle oben in der Leiste ein Fahrzeug aus, um seine Fixkosten anzuzeigen oder zu verwalten.',
  expensesSubtitle: '{vehicle} ({plate}) • Kfz-Steuer, Versicherung, Abonnements und Leasing verwalten.',
  expensesNoPlate: 'Kein Kennzeichen',
  expensesViewInTco: 'In TCO anzeigen',
  expensesAdd: 'Fixkosten hinzufügen',
  expensesSearchPlaceholder: 'Nach Beschreibung oder Notiz suchen...',
  expensesAllCategories: 'Alle Kategorien',
  expensesLoading: 'Fixkosten werden geladen...',
  expensesEmptyTitle: 'Noch keine Fixkosten erfasst',
  expensesEmptyHint: 'Füge wiederkehrende Kosten wie Kfz-Steuer, Kfz-Versicherung, Pannenhilfe oder Abonnements hinzu.',
  expensesLoadFailed: 'Fixkosten konnten nicht geladen werden',
  expenseValidation: 'Name, ein gültiger positiver Betrag (> € 0) und Startdatum sind erforderlich.',
  expenseSaveFailed: 'Fehler beim Speichern der Fixkosten',
  expenseStatusUpdateFailed: 'Status konnte nicht aktualisiert werden',
  expenseDeleteFailed: 'Fixkosten konnten nicht gelöscht werden',
  expenseDeleteTitle: 'Fixkosten löschen?',
  expenseDeleteConfirm: 'Möchtest du „{name}“ wirklich löschen? Das kann nicht rückgängig gemacht werden.',
  expensePaused: 'Pausiert',

  // Categories
  expenseCatTax: 'Kfz-Steuer',
  expenseCatInsurance: 'Kfz-Versicherung',
  expenseCatRoadside: 'Pannenhilfe',
  expenseCatSubscription: 'Abonnement',
  expenseCatLease: 'Leasing / Finanzierung',
  expenseCatInspection: 'Prüfung / HU',
  expenseCatOther: 'Sonstiges',

  // Frequencies
  expenseFreqMonthly: 'Monatlich (1 Mon.)',
  expenseFreqQuarterly: 'Vierteljährlich (3 Mon.)',
  expenseFreqYearly: 'Jährlich (12 Mon.)',

  // Templates
  expensePresetTaxLabel: 'Kfz-Steuer',
  expensePresetTaxName: 'Kfz-Steuer',
  expensePresetInsuranceLabel: 'Kfz-Versicherung',
  expensePresetInsuranceName: 'Kfz-Versicherung (Vollkasko / Haftpflicht)',
  expensePresetRoadsideLabel: 'ANWB Pannenhilfe',
  expensePresetRoadsideName: 'ANWB Wegenwacht Europa',
  expensePresetSubscriptionLabel: 'Flitsmeister PRO',
  expensePresetSubscriptionName: 'Flitsmeister PRO Abo',
  expensePresetLeaseLabel: 'Privatleasing',
  expensePresetLeaseName: 'Privatleasing Monatsrate',

  // Expense modal
  expenseEditTitle: 'Fixkosten bearbeiten',
  expenseNewTitle: 'Neue Fixkosten hinzufügen',
  expenseSelectTemplate: 'Vorlage auswählen',
  expenseDescriptionRequired: 'Beschreibung *',
  expenseCategory: 'Kategorie',
  expenseFrequency: 'Häufigkeit',
  expenseGrossAmountRequired: 'Bruttobetrag (€) *',
  expenseApproxPerMonth: '≈ € {amount} pro Monat',
  expenseStartDateRequired: 'Startdatum *',
  expenseEndDateOptional: 'Enddatum (optional)',
  expenseNotesOptional: 'Notizen (optional)',
  expenseNotesPlaceholder: 'Policennummer, Deckungsumfang...',
  expenseIsActive: 'Dieser Kostenposten ist derzeit aktiv',

  // Summary cards
  expenseMonthlyCost: 'Monatliche Kosten',
  expensePerMonthShort: '/ Mon.',
  expenseAmountPerYear: '€ {amount} pro Jahr',
  expenseActiveItems: 'Aktive Posten',
  expenseOfTotal: 'von {total}',
  expensePausedCount: '{count} pausiert',
  expenseAllActive: 'Alle erfassten Posten aktiv',
  expenseLargest: 'Größter Kostenposten',
  expenseNoActive: 'Keine aktiven Posten',
  expenseCategories: 'Kategorien',
  expenseActiveLower: 'aktiv',
  expenseCategoriesHint: 'Steuer, Versicherung, Abos',

  // Expense table
  expenseDescription: 'Beschreibung',
  expenseGrossAmount: 'Bruttobetrag',
  expensePerMonth: 'Pro Monat',
  expenseDuration: 'Laufzeit',
  expenseSince: 'Seit',
  expenseUntil: 'Bis',
  expenseOngoing: 'Unbefristet',
};
