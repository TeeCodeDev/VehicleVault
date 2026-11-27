import type { vignettes as nl } from '../nl/vignettes.js';

export const vignettes: Record<keyof typeof nl, string> = {
  // Vignettes page
  vignettesNoVehicleTitle: 'Kein aktives Fahrzeug ausgewählt',
  vignettesNoVehicleHint: 'Wähle oben in der Leiste ein Fahrzeug aus oder füge zuerst ein Fahrzeug hinzu, um Vignetten und Umweltplaketten zu verwalten.',
  vignettesGoToGarage: 'Zu Meine Garage',

  // Overview & cards
  vignettesActive: 'Aktive Vignetten',
  vignettesRegisteredCount: '/ {count} erfasst',
  vignettesTotalCost: 'Gesamtkosten',
  vignettesTravelTitle: 'Urlaubs- & Reisevignetten',
  vignettesTravelHint: 'Automatische Erinnerung vor Ablauf',
  vignettesAdd: 'Neue Vignette',
  vignettesLoading: 'Vignetten werden geladen...',
  vignettesEmptyTitle: 'Noch keine Vignetten oder Umweltplaketten erfasst',
  vignettesEmptyHint: "Behalte alle Vignetten für Österreich, die Schweiz, Frankreich (Crit'Air), Deutschland (Umweltplakette) und andere Länder im Blick, mit automatischen Erinnerungen vor Ablauf.",
  vignettesAddFirst: 'Erste Vignette hinzufügen',
  vignetteStatusLifetime: 'Unbefristet',
  vignetteStatusExpired: 'Abgelaufen',
  vignetteStatusExpiring: 'Läuft ab ({days} T.)',
  vignetteStatusFuture: 'Gültig in {days} T.',
  vignetteStatusActive: 'Aktiv ({days} T.)',
  vignetteValidFromLabel: 'Gültig ab:',
  vignetteValidUntilLabel: 'Gültig bis:',
  vignetteIndefinite: 'Unbefristet',
  vignetteRefLabel: 'Bestell-/Vignettennr.:',
  vignetteViewProof: 'Kaufbeleg ansehen',
  vignetteSaveFailed: 'Fehler beim Speichern der Vignette',
  vignetteDeleteConfirm: 'Möchtest du diese Vignette wirklich löschen?',
  vignetteOtherCountry: 'Anderes Land',

  // Types
  vignetteTypeTollDigital: 'Digitale Vignette',
  vignetteTypeTollSticker: 'Klebevignette',
  vignetteTypeEmission: 'Umweltplakette',
  vignetteTypeOther: 'Sonstige Vignette',
  vignetteOptionTollDigital: 'Digitale Vignette (E-Vignette)',
  vignetteOptionTollSticker: 'Klebevignette',
  vignetteOptionEmission: "Umweltplakette (z. B. Crit'Air)",
  vignetteOptionOther: 'Sonstige Vignette / Pass',

  // Default names per country
  vignetteDefaultName: 'Digitale Vignette (10 Tage)',
  vignetteDefaultAT: 'Digitale Vignette Österreich (10 Tage)',
  vignetteDefaultCH: 'E-Vignette Schweiz',
  vignetteDefaultFR: "Crit'Air-Plakette Kategorie 1",
  vignetteDefaultDE: 'Umweltplakette Deutschland (Grün 4)',
  vignetteDefaultSI: 'E-Vignette Slowenien (7 Tage)',

  // Vignette modal
  vignetteEditTitle: 'Vignette / Umweltplakette bearbeiten',
  vignetteNewTitle: 'Neue Vignette oder Umweltplakette hinzufügen',
  vignetteCountry: 'Land',
  vignetteTypeLabel: 'Art der Vignette / Plakette',
  vignetteNameLabel: 'Name oder Beschreibung *',
  vignetteNamePlaceholder: 'z. B. Digitale Vignette 10 Tage',
  vignetteValidFrom: 'Gültig ab',
  vignetteValidUntil: 'Gültig bis (leer = unbefristet)',
  vignetteCost: 'Kaufpreis (€)',
  vignetteReference: 'Bestell- / Referenznummer',
  vignetteLinkedProof: 'Verknüpfter Kaufbeleg aus Dokumenten',
  vignetteNoProof: 'Kein Kaufbeleg verknüpft',
  vignetteNotesOptional: 'Notizen (optional)',
  vignetteNotesPlaceholder: 'z. B. Für den Sommerurlaub in Kärnten gekauft',
  vignetteSave: 'Vignette speichern',
};
