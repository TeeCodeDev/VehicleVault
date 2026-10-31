import { randomBytes } from 'node:crypto';
import { requestDeviceCode, pollDeviceCode, type DevicePoll } from './microsoftMailService.js';

/**
 * The Microsoft sign-ins in progress. A device code is a secret until the admin has entered it: whoever holds it can
 * collect the tokens afterwards, so it stays in memory here, is tied to the admin who started it, and never reaches
 * a page. The page only gets an opaque id.
 */

const MAX_PER_USER = 2;

interface Pending {
  userId: string;
  tenant: string;
  clientId: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  /** Microsoft's own pace: asking sooner is answered with slow_down. */
  nextPollAt: number;
  intervalMs: number;
}

export interface SignInStart {
  id: string;
  userCode: string;
  verificationUri: string;
  expiresAt: Date;
}

export type SignInPoll =
  | { state: 'pending'; userCode: string; verificationUri: string; expiresAt: Date }
  | { state: 'unknown' }
  | (Extract<DevicePoll, { state: 'failed' | 'done' }> & { clientId?: string });

export class MicrosoftSignIn {
  private readonly pending = new Map<string, Pending>();
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly now: () => number;

  constructor(options: { fetch?: typeof fetch; now?: () => number } = {}) {
    this.fetchImpl = options.fetch;
    this.now = options.now ?? Date.now;
  }

  private sweep(): void {
    for (const [id, p] of this.pending) if (p.expiresAt <= this.now()) this.pending.delete(id);
  }

  async start(userId: string, input: { tenant: string; clientId: string }): Promise<SignInStart> {
    this.sweep();
    // Starting again replaces what this admin had open, so a stuck page cannot pile up codes.
    const mine = [...this.pending].filter(([, p]) => p.userId === userId);
    while (mine.length >= MAX_PER_USER) {
      const oldest = mine.shift();
      if (oldest) this.pending.delete(oldest[0]);
    }
    const code = await requestDeviceCode(input.tenant, input.clientId, this.fetchImpl);
    const id = randomBytes(16).toString('base64url');
    const at = this.now();
    this.pending.set(id, {
      userId,
      tenant: input.tenant,
      clientId: input.clientId,
      deviceCode: code.deviceCode,
      userCode: code.userCode,
      verificationUri: code.verificationUri,
      expiresAt: at + code.expiresInSeconds * 1000,
      nextPollAt: at + code.intervalSeconds * 1000,
      intervalMs: code.intervalSeconds * 1000,
    });
    return { id, userCode: code.userCode, verificationUri: code.verificationUri, expiresAt: new Date(at + code.expiresInSeconds * 1000) };
  }

  /** Looks whether the admin has signed in. Asked too soon, it says "pending" without asking Microsoft. */
  async poll(userId: string, id: string): Promise<SignInPoll> {
    this.sweep();
    const p = this.pending.get(id);
    if (!p || p.userId !== userId) return { state: 'unknown' };
    const waiting = { state: 'pending' as const, userCode: p.userCode, verificationUri: p.verificationUri, expiresAt: new Date(p.expiresAt) };
    if (this.now() < p.nextPollAt) return waiting;
    p.nextPollAt = this.now() + p.intervalMs;
    const result = await pollDeviceCode(p.tenant, p.clientId, p.deviceCode, this.fetchImpl);
    if (result.state === 'pending') {
      if (result.slowDown) {
        p.intervalMs += 5000;
        p.nextPollAt = this.now() + p.intervalMs;
      }
      return waiting;
    }
    // Done or failed: the device code is spent either way.
    this.pending.delete(id);
    return result.state === 'done' ? { ...result, clientId: p.clientId } : result;
  }

  cancel(userId: string, id: string): void {
    if (this.pending.get(id)?.userId === userId) this.pending.delete(id);
  }
}
