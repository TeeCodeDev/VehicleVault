export interface EmailPreset {
  id: 'gmail' | 'microsoft365' | 'outlook';
  label: string;
  host: string;
  port: number;
  /** true = implicit TLS (port 465); false = STARTTLS on 587. */
  secure: boolean;
  nl: string;
  en: string;
}

export const EMAIL_PRESETS: EmailPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    nl: 'Gebruik je volledige Gmail-adres als gebruiker en een app-wachtwoord (Google-account → Beveiliging → Verificatie in 2 stappen → App-wachtwoorden). Je gewone wachtwoord werkt niet.',
    en: 'Use your full Gmail address as user and an app password (Google Account → Security → 2-Step Verification → App passwords). Your normal password will not work.',
  },
  {
    id: 'microsoft365',
    label: 'Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    nl: 'Gebruik het volledige e-mailadres van de mailbox als gebruiker. De beheerder moet "Geverifieerde SMTP-client" (SMTP AUTH) voor die mailbox hebben ingeschakeld, en de afzender moet het adres van die mailbox zijn. Is SMTP AUTH bij jullie uitgeschakeld, kies dan hierboven "Microsoft Graph".',
    en: 'Use the full mailbox address as user. An admin must have enabled "Authenticated SMTP" (SMTP AUTH) for that mailbox, and the sender must be that mailbox address. If SMTP AUTH is disabled in your tenant, choose "Microsoft Graph" above.',
  },
  {
    id: 'outlook',
    label: 'Outlook.com',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    nl: 'Gebruik je volledige Outlook.com/Hotmail-adres als gebruiker. Met tweestapsverificatie heb je een app-wachtwoord nodig (Microsoft-account → Beveiliging → App-wachtwoorden).',
    en: 'Use your full Outlook.com/Hotmail address as user. With two-step verification you need an app password (Microsoft account → Security → App passwords).',
  },
];

/**
 * The fields a preset sets. When the user has already typed an address and no From yet (or the default one),
 * the From follows the user: Gmail and Microsoft reject mail that claims another sender.
 */
export function applyEmailPreset(preset: EmailPreset, current: { user: string; from: string }) {
  const placeholderFrom = !current.from || current.from.includes('vehiclevault.local');
  return {
    host: preset.host,
    port: preset.port,
    secure: preset.secure,
    from: placeholderFrom && current.user.includes('@') ? `VehicleVault <${current.user}>` : current.from,
  };
}
