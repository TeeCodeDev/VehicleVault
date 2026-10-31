/**
 * Turns the raw errors of SMTP servers (nodemailer) and Microsoft Graph into one sentence the admin can act on:
 * what failed, and the setting that usually fixes it.
 */

export interface MailFailure {
  message: string;
  hint?: string;
}

const isMicrosoftHost = (host?: string) => /office365\.com|outlook\.com|microsoft\.com/i.test(host || '');
const isGmailHost = (host?: string) => /gmail\.com|googlemail\.com/i.test(host || '');

export function describeSmtpError(err: any, host?: string): MailFailure {
  const raw = String(err?.message || 'Onbekende fout');
  const code = String(err?.code || '');
  const response = String(err?.response || '');
  const haystack = `${raw} ${response}`;

  if (code === 'EAUTH' || /\b535\b|\b534\b|authentication/i.test(haystack)) {
    if (/5\.7\.139|5\.7\.57|SmtpClientAuthentication|basic authentication is disabled/i.test(haystack)) {
      return {
        message: raw,
        hint: 'Microsoft 365 heeft SMTP AUTH (basis-authenticatie) uitgeschakeld voor deze mailbox of tenant. Laat een beheerder "Geverifieerde SMTP-client" voor de mailbox inschakelen, of kies verzenden via Microsoft Graph.',
      };
    }
    if (isGmailHost(host)) {
      return {
        message: raw,
        hint: 'Gmail accepteert je gewone wachtwoord niet. Zet tweestapsverificatie aan en maak een app-wachtwoord (Google-account → Beveiliging → App-wachtwoorden). Gebruik je volledige Gmail-adres als gebruiker.',
      };
    }
    if (isMicrosoftHost(host)) {
      return {
        message: raw,
        hint: 'Inloggen is geweigerd. Gebruik het volledige e-mailadres als gebruiker. Heeft het account tweestapsverificatie, maak dan een app-wachtwoord aan.',
      };
    }
    return {
      message: raw,
      hint: 'Inloggen is geweigerd: controleer gebruiker en wachtwoord. Veel providers vragen een app-wachtwoord in plaats van het gewone wachtwoord.',
    };
  }

  if (/wrong version number|ssl3_get_record|packet length too long|unexpected response/i.test(haystack)) {
    return {
      message: raw,
      hint: 'De versleuteling past niet bij de poort. Poort 465 gebruikt directe SSL/TLS (vinkje aan); poort 587 gebruikt STARTTLS (vinkje uit).',
    };
  }

  if (/self[- ]signed|unable to verify|CERT_|certificate|hostname\/ip does not match/i.test(haystack)) {
    return {
      message: raw,
      hint: 'Het certificaat van de mailserver wordt niet vertrouwd of past niet bij de hostnaam. Controleer de servernaam, of schakel onder Geavanceerd certificaatfouten negeren in voor een server met een eigen certificaat.',
    };
  }

  if (code === 'ENOTFOUND' || code === 'EDNS') {
    return { message: raw, hint: 'De servernaam bestaat niet of is niet te bereiken vanaf VehicleVault. Controleer de spelling en de DNS van de container.' };
  }
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ECONNRESET') {
    return {
      message: raw,
      hint: 'Geen verbinding met de mailserver. Controleer host en poort (587 of 465) en of een firewall of je provider uitgaand SMTP blokkeert.',
    };
  }

  if (code === 'EENVELOPE' || /\b55[0-4]\b|sender|recipient|mailbox unavailable/i.test(haystack)) {
    return {
      message: raw,
      hint: 'De server weigert de afzender of ontvanger. Veel providers (Gmail, Microsoft 365) staan alleen het adres van de ingelogde mailbox als afzender toe.',
    };
  }

  return { message: raw };
}

const AAD_HINTS: Array<[RegExp, string]> = [
  [/AADSTS7000215|invalid_client|client secret/i, 'Het client secret klopt niet of is verlopen. Maak in Azure een nieuw secret aan en vul de waarde (niet de secret-ID) in.'],
  [/AADSTS700016|application with identifier .* was not found/i, 'De Application (client) ID is niet gevonden in deze tenant. Controleer de Client ID en de Tenant ID.'],
  [/AADSTS90002|AADSTS900023|tenant .* not found|invalid tenant/i, 'De Tenant ID is onbekend. Gebruik de Directory (tenant) ID uit de app-registratie.'],
  [/AADSTS70011|invalid_scope/i, 'De aangevraagde scope is ongeldig. Gebruik een app-registratie in Microsoft Entra ID met de toepassingsmachtiging Mail.Send.'],
];

export function describeGraphError(status: number, body: string): MailFailure {
  let code = '';
  let detail = '';
  try {
    const json = JSON.parse(body);
    code = String(json?.error?.code || json?.error || '');
    detail = String(json?.error?.message || json?.error_description || '');
  } catch {
    detail = body.slice(0, 300);
  }
  const message = `Microsoft ${status}${code ? ` ${code}` : ''}${detail ? `: ${detail.split('\r\n')[0]}` : ''}`;

  const haystack = `${code} ${detail}`;
  for (const [pattern, hint] of AAD_HINTS) {
    if (pattern.test(haystack)) return { message, hint };
  }
  if (status === 401) {
    return { message, hint: 'Microsoft weigert de aanmelding. Controleer Tenant ID, Client ID en client secret.' };
  }
  if (status === 403 || /ErrorAccessDenied|Authorization_RequestDenied/i.test(haystack)) {
    return {
      message,
      hint: 'De app mag geen e-mail versturen. Voeg in Azure onder API-machtigingen de toepassingsmachtiging Mail.Send (Microsoft Graph) toe en geef beheerderstoestemming.',
    };
  }
  if (status === 404 || /ErrorInvalidUser|MailboxNotEnabledForRESTAPI|ResourceNotFound/i.test(haystack)) {
    return {
      message,
      hint: 'De afzender-mailbox is niet gevonden of heeft geen Exchange Online-licentie. Controleer het afzenderadres (UPN of primair e-mailadres).',
    };
  }
  if (status === 429) {
    return { message, hint: 'Microsoft beperkt het aantal berichten. Probeer het over enkele minuten opnieuw.' };
  }
  return { message };
}

export function formatFailure(failure: MailFailure): string {
  return failure.hint ? `${failure.message}. ${failure.hint}` : failure.message;
}
