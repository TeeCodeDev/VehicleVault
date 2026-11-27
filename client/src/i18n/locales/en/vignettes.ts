import type { vignettes as nl } from '../nl/vignettes.js';

export const vignettes: Record<keyof typeof nl, string> = {
  // Vignettes page
  vignettesNoVehicleTitle: 'No active vehicle selected',
  vignettesNoVehicleHint: 'Select a vehicle from the top bar or add a vehicle first to manage toll vignettes and emission stickers.',
  vignettesGoToGarage: 'Go to My Garage',

  // Overview & cards
  vignettesActive: 'Active Vignettes',
  vignettesRegisteredCount: '/ {count} registered',
  vignettesTotalCost: 'Total Expense',
  vignettesTravelTitle: 'Travel & Toll Badges',
  vignettesTravelHint: 'Automatic expiry notifications',
  vignettesAdd: 'Add Vignette',
  vignettesLoading: 'Loading vignettes...',
  vignettesEmptyTitle: 'No vignettes registered yet',
  vignettesEmptyHint: "Keep all your toll vignettes for Austria, Switzerland, France (Crit'Air), Germany (Umweltplakette) and other countries organized with automatic expiry alerts.",
  vignettesAddFirst: 'Add First Vignette',
  vignetteStatusLifetime: 'Lifetime',
  vignetteStatusExpired: 'Expired',
  vignetteStatusExpiring: 'Expires ({days}d)',
  vignetteStatusFuture: 'Starts in {days}d',
  vignetteStatusActive: 'Active ({days}d)',
  vignetteValidFromLabel: 'Valid from:',
  vignetteValidUntilLabel: 'Valid until:',
  vignetteIndefinite: 'Indefinite',
  vignetteRefLabel: 'Ref / Number:',
  vignetteViewProof: 'View invoice',
  vignetteSaveFailed: 'Error saving vignette',
  vignetteDeleteConfirm: 'Are you sure you want to delete this vignette?',
  vignetteOtherCountry: 'Other country',

  // Types
  vignetteTypeTollDigital: 'Digital Toll Vignette',
  vignetteTypeTollSticker: 'Physical Toll Sticker',
  vignetteTypeEmission: 'Environmental Badge',
  vignetteTypeOther: 'Other Vignette',
  vignetteOptionTollDigital: 'Digital Toll (E-Vignette)',
  vignetteOptionTollSticker: 'Physical Toll Sticker',
  vignetteOptionEmission: "Low-Emission Badge (Crit'Air / Umweltplakette)",
  vignetteOptionOther: 'Other Pass',

  // Default names per country
  vignetteDefaultName: 'Digital Toll Vignette (10 days)',
  vignetteDefaultAT: 'Digital Toll Vignette Austria (10 days)',
  vignetteDefaultCH: 'E-Vignette Switzerland',
  vignetteDefaultFR: "Crit'Air Emission Sticker Category 1",
  vignetteDefaultDE: 'Umweltplakette Germany (Green 4)',
  vignetteDefaultSI: 'E-Vignette Slovenia (7 days)',

  // Vignette modal
  vignetteEditTitle: 'Edit Vignette / Badge',
  vignetteNewTitle: 'Add New Vignette / Badge',
  vignetteCountry: 'Country',
  vignetteTypeLabel: 'Vignette Type',
  vignetteNameLabel: 'Title / Description *',
  vignetteNamePlaceholder: 'e.g. 10-Day Digital Toll',
  vignetteValidFrom: 'Valid from',
  vignetteValidUntil: 'Valid until (empty = lifetime)',
  vignetteCost: 'Cost (€)',
  vignetteReference: 'Order / Reference Nr',
  vignetteLinkedProof: 'Linked Proof from Documents',
  vignetteNoProof: 'No document linked',
  vignetteNotesOptional: 'Notes (optional)',
  vignetteNotesPlaceholder: 'e.g. Bought for the summer holiday in Carinthia',
  vignetteSave: 'Save Vignette',
};
