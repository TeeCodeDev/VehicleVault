import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';

import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { PasskeyController } from '../controllers/passkeyController.js';
import { PasskeyService } from '../services/passkeyService.js';
import { classifyPasskeyOrigin } from '../utils/passkeyHost.js';
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from '../utils/recoveryCodes.js';
import { verifyAccessToken } from '../utils/token.js';

const ORIGIN = 'http://localhost:3001';
const RP_ID = 'localhost';
const b64 = (buf: Uint8Array) => Buffer.from(buf).toString('base64url');

/** A software authenticator: ES256, attestation "none". Enough to drive both ceremonies. */
class FakeAuthenticator {
  readonly credentialId = crypto.randomBytes(32);
  private readonly keys = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  counter = 0;

  private rpIdHash(rpId = RP_ID) {
    return crypto.createHash('sha256').update(rpId).digest();
  }

  private clientData(type: string, challenge: string, origin: string) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  private authData(flags: number, attested: boolean) {
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.counter);
    const head = Buffer.concat([this.rpIdHash(), Buffer.from([flags]), counter]);
    if (!attested) return head;
    const jwk = this.keys.publicKey.export({ format: 'jwk' });
    const cose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x!, 'base64url')],
        [-3, Buffer.from(jwk.y!, 'base64url')],
      ])
    );
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(this.credentialId.length);
    return Buffer.concat([head, Buffer.alloc(16), idLength, this.credentialId, Buffer.from(cose)]);
  }

  register(challenge: string, origin = ORIGIN) {
    const attestationObject = isoCBOR.encode(
      new Map<string, any>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', this.authData(0x45, true)],
      ])
    );
    return {
      id: b64(this.credentialId),
      rawId: b64(this.credentialId),
      type: 'public-key',
      response: {
        clientDataJSON: b64(this.clientData('webauthn.create', challenge, origin)),
        attestationObject: b64(attestationObject),
        transports: ['internal'],
      },
      clientExtensionResults: {},
    };
  }

  assert(challenge: string, origin = ORIGIN) {
    this.counter += 1;
    const authData = this.authData(0x05, false);
    const clientData = this.clientData('webauthn.get', challenge, origin);
    const signature = crypto.sign(
      'sha256',
      Buffer.concat([authData, crypto.createHash('sha256').update(clientData).digest()]),
      this.keys.privateKey
    );
    return {
      id: b64(this.credentialId),
      rawId: b64(this.credentialId),
      type: 'public-key',
      response: {
        clientDataJSON: b64(clientData),
        authenticatorData: b64(authData),
        signature: b64(signature),
      },
      clientExtensionResults: {},
    };
  }
}

function mockRes() {
  const res: any = { statusCode: 200, body: null, cookies: {} as Record<string, string> };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: unknown) => {
    res.body = data;
    return res;
  };
  res.cookie = (name: string, value: string) => {
    res.cookies[name] = value;
    return res;
  };
  return res;
}

function mockReq(extra: Record<string, unknown> = {}) {
  return { headers: { host: 'localhost:3001' }, protocol: 'http', body: {}, params: {}, ...extra } as any;
}

function signedIn(userId: string, email: string) {
  return { userId, email, role: 'user', isApiKey: false };
}

describe('Passkeys & Recovery Codes', () => {
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const created = [userA, userB];

  function insertUser(id: string, passwordHash = 'bcrypt-hash') {
    const now = new Date().toISOString();
    db.run('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
      id,
      `${id}@passkeys.test`,
      passwordHash,
      'user',
      now,
      now,
    ]);
  }

  async function addPasskey(userId: string, authenticator = new FakeAuthenticator()) {
    const optionsRes = mockRes();
    await PasskeyController.registerOptions(mockReq({ user: signedIn(userId, `${userId}@passkeys.test`) }), optionsRes);
    assert.equal(optionsRes.statusCode, 200);
    const verifyRes = mockRes();
    await PasskeyController.registerVerify(
      mockReq({
        user: signedIn(userId, `${userId}@passkeys.test`),
        body: { credential: authenticator.register(optionsRes.body.challenge), label: 'Testtelefoon' },
      }),
      verifyRes
    );
    return { authenticator, optionsRes, verifyRes };
  }

  before(() => {
    initializeDatabase();
    insertUser(userA);
    insertUser(userB);
  });

  after(() => {
    for (const id of created) db.run('DELETE FROM users WHERE id = ?', [id]);
    db.run("DELETE FROM auth_challenges WHERE purpose IN ('login', 'register')");
  });

  describe('Recovery codes', () => {
    it('keeps the generator and the parser in step', () => {
      for (let i = 0; i < 200; i++) {
        const code = generateRecoveryCode();
        assert.match(code, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
        assert.equal(normalizeRecoveryCode(code), code.replace(/-/g, ''));
      }
    });

    it('forgives transcription noise but not look-alikes', () => {
      const code = generateRecoveryCode();
      const raw = code.replace(/-/g, '');
      assert.equal(normalizeRecoveryCode(` ${code.toLowerCase()} `), raw);
      assert.equal(normalizeRecoveryCode(code.replace(/-/g, '–')), raw);
      assert.equal(normalizeRecoveryCode(code.replace(/-/g, ' ')), raw);
      assert.equal(normalizeRecoveryCode('0'.repeat(16)), null);
      assert.equal(normalizeRecoveryCode(`I${raw.slice(1)}`), null);
      assert.equal(normalizeRecoveryCode(raw.slice(1)), null);
      assert.equal(normalizeRecoveryCode(undefined), null);
    });

    it('redeems a code exactly once and gives one answer for every rejection', async () => {
      const [code] = PasskeyService.replaceRecoveryCodes(userA);
      assert.equal(PasskeyService.countRecoveryCodes(userA), RECOVERY_CODE_COUNT);
      assert.equal(
        db.get('SELECT 1 FROM recovery_codes WHERE code_hash = ?', [hashRecoveryCode(normalizeRecoveryCode(code)!)]) !== undefined,
        true
      );
      assert.equal(JSON.stringify(db.query('SELECT code_hash FROM recovery_codes')).includes(code.replace(/-/g, '')), false);

      const ok = mockRes();
      await PasskeyController.redeemRecoveryCode(mockReq({ body: { code: code.toLowerCase() } }), ok);
      assert.equal(ok.statusCode, 200);
      assert.equal(verifyAccessToken(ok.body.accessToken)?.userId, userA);
      assert.ok(ok.cookies.refresh_token);
      assert.equal(ok.body.recoveryCodesRemaining, RECOVERY_CODE_COUNT - 1);

      const replay = mockRes();
      await PasskeyController.redeemRecoveryCode(mockReq({ body: { code } }), replay);
      const garbage = mockRes();
      await PasskeyController.redeemRecoveryCode(mockReq({ body: { code: 'not-a-code' } }), garbage);
      const unknown = mockRes();
      await PasskeyController.redeemRecoveryCode(mockReq({ body: { code: generateRecoveryCode() } }), unknown);
      for (const res of [replay, garbage, unknown]) {
        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, replay.body);
        assert.equal(res.cookies.refresh_token, undefined);
      }
    });
  });

  describe('Challenges and availability', () => {
    it('spends a challenge once, only for its own purpose and user', () => {
      PasskeyService.saveChallenge('c-1', 'register', userA);
      assert.equal(PasskeyService.consumeChallenge('c-1', 'login', null), false);
      assert.equal(PasskeyService.consumeChallenge('c-1', 'register', userB), false);
      assert.equal(PasskeyService.consumeChallenge('c-1', 'register', userA), true);
      assert.equal(PasskeyService.consumeChallenge('c-1', 'register', userA), false);
    });

    it('refuses an expired challenge', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      db.run('INSERT INTO auth_challenges (challenge, purpose, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', [
        'c-old',
        'login',
        null,
        past,
        past,
      ]);
      assert.equal(PasskeyService.consumeChallenge('c-old', 'login', null), false);
    });

    it('explains why a passkey cannot work on an IP address or plain HTTP', () => {
      assert.equal(classifyPasskeyOrigin('http://192.168.1.20:3001').available, false);
      assert.match(classifyPasskeyOrigin('http://192.168.1.20:3001').reason!, /IP-adres/);
      assert.match(classifyPasskeyOrigin('http://vault.example.com').reason!, /HTTPS/);
      assert.equal(classifyPasskeyOrigin('https://vault.example.com').available, true);
      assert.equal(classifyPasskeyOrigin('http://localhost:3001').available, true);
    });
  });

  describe('Registration and sign-in ceremonies', () => {
    it('registers a passkey, hands out recovery codes once, and signs in with it', async () => {
      db.run('DELETE FROM recovery_codes WHERE user_id = ?', [userA]);
      const { authenticator, verifyRes } = await addPasskey(userA);
      assert.equal(verifyRes.statusCode, 201);
      assert.equal(verifyRes.body.passkey.label, 'Testtelefoon');
      assert.equal(verifyRes.body.recoveryCodes.length, RECOVERY_CODE_COUNT);

      const optionsRes = mockRes();
      await PasskeyController.loginOptions(mockReq(), optionsRes);
      assert.equal(optionsRes.statusCode, 200);
      assert.equal(optionsRes.body.userVerification, 'required');

      const loginRes = mockRes();
      await PasskeyController.loginVerify(mockReq({ body: authenticator.assert(optionsRes.body.challenge) }), loginRes);
      assert.equal(loginRes.statusCode, 200);
      assert.equal(verifyAccessToken(loginRes.body.accessToken)?.userId, userA);
      assert.ok(loginRes.cookies.refresh_token);
      assert.equal(db.get<any>('SELECT counter FROM passkey_credentials WHERE id = ?', [b64(authenticator.credentialId)])!.counter, 1);
    });

    it('does not hand out a second set of recovery codes', async () => {
      const { verifyRes } = await addPasskey(userA);
      assert.equal(verifyRes.statusCode, 201);
      assert.equal(verifyRes.body.recoveryCodes, undefined);
    });

    it('refuses a replayed assertion, a wrong origin and an unknown credential with one message', async () => {
      const { authenticator } = await addPasskey(userB);

      const first = mockRes();
      await PasskeyController.loginOptions(mockReq(), first);
      const assertion = authenticator.assert(first.body.challenge);
      const ok = mockRes();
      await PasskeyController.loginVerify(mockReq({ body: assertion }), ok);
      assert.equal(ok.statusCode, 200);

      const replay = mockRes();
      await PasskeyController.loginVerify(mockReq({ body: assertion }), replay);

      const second = mockRes();
      await PasskeyController.loginOptions(mockReq(), second);
      const wrongOrigin = mockRes();
      await PasskeyController.loginVerify(
        mockReq({ body: authenticator.assert(second.body.challenge, 'https://evil.example.com') }),
        wrongOrigin
      );

      const third = mockRes();
      await PasskeyController.loginOptions(mockReq(), third);
      const stranger = mockRes();
      await PasskeyController.loginVerify(mockReq({ body: new FakeAuthenticator().assert(third.body.challenge) }), stranger);

      for (const res of [replay, wrongOrigin, stranger]) {
        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, replay.body);
        assert.equal(res.cookies.refresh_token, undefined);
      }
    });

    it('refuses to register a passkey from another origin', async () => {
      const optionsRes = mockRes();
      await PasskeyController.registerOptions(mockReq({ user: signedIn(userB, 'b') }), optionsRes);
      const res = mockRes();
      await PasskeyController.registerVerify(
        mockReq({
          user: signedIn(userB, 'b'),
          body: { credential: new FakeAuthenticator().register(optionsRes.body.challenge, 'https://evil.example.com') },
        }),
        res
      );
      assert.equal(res.statusCode, 400);
    });

    it('does not let an API key or a missing session manage passkeys', async () => {
      const apiKey = mockRes();
      await PasskeyController.list(mockReq({ user: { ...signedIn(userA, 'a'), isApiKey: true } }), apiKey);
      assert.equal(apiKey.statusCode, 403);
      const anonymous = mockRes();
      await PasskeyController.registerOptions(mockReq(), anonymous);
      assert.equal(anonymous.statusCode, 403);
    });
  });

  describe('Managing passkeys', () => {
    it('lets a user touch only their own passkeys', async () => {
      const aPasskey = PasskeyService.listForUser(userA)[0];
      const rename = mockRes();
      await PasskeyController.rename(mockReq({ user: signedIn(userB, 'b'), params: { id: aPasskey.id }, body: { label: 'Gekaapt' } }), rename);
      assert.equal(rename.statusCode, 404);
      const remove = mockRes();
      await PasskeyController.remove(mockReq({ user: signedIn(userB, 'b'), params: { id: aPasskey.id } }), remove);
      assert.equal(remove.statusCode, 404);
      assert.equal(PasskeyService.listForUser(userA).some((p) => p.id === aPasskey.id), true);

      const list = mockRes();
      await PasskeyController.list(mockReq({ user: signedIn(userB, 'b') }), list);
      assert.equal(list.body.passkeys.every((p: any) => p.id !== aPasskey.id), true);
    });

    it('keeps the last way to sign in', async () => {
      const lonely = crypto.randomUUID();
      created.push(lonely);
      insertUser(lonely, 'proxy_auth_placeholder');
      const { authenticator } = await addPasskey(lonely);
      assert.equal(PasskeyService.hasPassword(lonely), false);

      const refused = mockRes();
      await PasskeyController.remove(
        mockReq({ user: signedIn(lonely, 'l'), params: { id: b64(authenticator.credentialId) } }),
        refused
      );
      assert.equal(refused.statusCode, 400);

      // Someone with a real password may remove their only passkey; the recovery codes go with it.
      const withPassword = PasskeyService.listForUser(userB)[0];
      const removed = mockRes();
      await PasskeyController.remove(mockReq({ user: signedIn(userB, 'b'), params: { id: withPassword.id } }), removed);
      assert.equal(removed.statusCode, 200);
      assert.equal(PasskeyService.countRecoveryCodes(userB), 0);
    });

    it('removes passkeys and recovery codes together with the user', () => {
      assert.ok(PasskeyService.listForUser(userA).length > 0);
      assert.ok(PasskeyService.countRecoveryCodes(userA) > 0);
      db.run('DELETE FROM users WHERE id = ?', [userA]);
      assert.equal(PasskeyService.listForUser(userA).length, 0);
      assert.equal(PasskeyService.countRecoveryCodes(userA), 0);
    });
  });
});
