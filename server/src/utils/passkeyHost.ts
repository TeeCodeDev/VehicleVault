import net from 'node:net';
import { Request } from 'express';
import { env } from '../config/env.js';

function firstHeader(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '')
    .split(',')[0]
    .trim();
}

/** Origin the browser used, honouring the reverse proxy's X-Forwarded-* headers. */
export function requestOrigin(req: Request): string {
  const proto = firstHeader(req.headers['x-forwarded-proto']) || req.protocol || 'http';
  const host = firstHeader(req.headers['x-forwarded-host']) || firstHeader(req.headers.host);
  return `${proto}://${host}`.toLowerCase();
}

/** Relying party for this request: RP_ID / RP_ORIGINS when configured, else the request itself. */
export function getRelyingParty(req: Request): { rpID: string; origins: string[] } {
  const origin = requestOrigin(req);
  let hostname = '';
  try {
    hostname = new URL(origin).hostname;
  } catch {}
  return {
    rpID: env.RP_ID || hostname,
    origins: env.RP_ORIGINS.length > 0 ? env.RP_ORIGINS : [origin],
  };
}

export interface PasskeyAvailability {
  available: boolean;
  reason?: string;
}

/**
 * Can a passkey work from this origin? WebAuthn needs a domain name (not an IP address) and a
 * secure context (HTTPS, or localhost). The reason is shown to the operator verbatim.
 */
export function classifyPasskeyOrigin(origin: string): PasskeyAvailability {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return { available: false, reason: 'Het adres van deze pagina kon niet worden bepaald.' };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost');

  if (net.isIP(hostname)) {
    return {
      available: false,
      reason: `Je opent VehicleVault via een IP-adres (${hostname}). Een passkey heeft een domeinnaam nodig.`,
    };
  }

  if (!isLocalhost && url.protocol !== 'https:') {
    return {
      available: false,
      reason: 'Een passkey werkt alleen via HTTPS. Open VehicleVault via een https-adres, bijvoorbeeld achter een reverse proxy.',
    };
  }

  if (env.RP_ID && hostname !== env.RP_ID && !hostname.endsWith(`.${env.RP_ID}`)) {
    return {
      available: false,
      reason: `Dit adres (${hostname}) hoort niet bij het ingestelde RP_ID (${env.RP_ID}).`,
    };
  }

  return { available: true };
}
