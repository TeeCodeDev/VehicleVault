import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { apiFetch } from '../api/client.js';
import { User } from '../types/index.js';

export interface SessionResponse {
  accessToken: string;
  user: User;
}

/** Turn a failed browser ceremony into a sentence for the person who pressed the button. */
export function passkeyErrorMessage(err: any, lang: 'nl' | 'en' = 'nl'): string {
  const name = err?.name || err?.cause?.name;
  if (name === 'NotAllowedError' || name === 'AbortError' || err?.code === 'ERROR_CEREMONY_ABORTED') {
    return lang === 'nl' ? 'De passkey-prompt is geannuleerd of verlopen.' : 'The passkey prompt was cancelled or timed out.';
  }
  if (err?.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
    return lang === 'nl' ? 'Dit apparaat heeft al een passkey voor VehicleVault.' : 'This device already has a passkey for VehicleVault.';
  }
  return err?.message || (lang === 'nl' ? 'Er ging iets mis met de passkey.' : 'Something went wrong with the passkey.');
}

export function passkeysSupported(): boolean {
  return browserSupportsWebAuthn();
}

export async function signInWithPasskey(): Promise<SessionResponse> {
  const optionsJSON = await apiFetch('/api/auth/passkey/login/options', { method: 'POST' });
  const assertion = await startAuthentication({ optionsJSON });
  return apiFetch<SessionResponse>('/api/auth/passkey/login/verify', {
    method: 'POST',
    body: JSON.stringify(assertion),
  });
}

export async function registerPasskey(label: string): Promise<{ recoveryCodes?: string[] }> {
  const optionsJSON = await apiFetch('/api/auth/passkeys/register/options', { method: 'POST' });
  const credential = await startRegistration({ optionsJSON });
  return apiFetch('/api/auth/passkeys/register/verify', {
    method: 'POST',
    body: JSON.stringify({ credential, label: label || undefined }),
  });
}
