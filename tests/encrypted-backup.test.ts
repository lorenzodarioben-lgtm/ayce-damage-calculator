import { describe, expect, it } from 'vitest';
import {
  AES_TAG_BITS,
  IV_BYTES,
  MAX_ACCEPTED_ITERATIONS,
  MAX_VAULT_BYTES,
  MIN_ACCEPTED_ITERATIONS,
  MIN_VAULT_PASSWORD_LENGTH,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
  VAULT_FORMAT,
  VAULT_VERSION,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  parseVaultEnvelope,
  vaultFilename,
  type VaultEnvelope,
} from '@/lib/encryptedBackup';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  serialiseBackup,
} from '@/lib/backup';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { decodeBase64, encodeBase64 } from '@/lib/urlText';
import { getVerdict } from '@/lib/verdicts';
import type { MealSession } from '@/types/meal';

const AT = '2026-08-16T12:00:00.000Z';
const PASSWORD = 'a-perfectly-ordinary-passphrase';

const PLAIN_BACKUP = JSON.stringify({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: AT,
  history: [],
  favorites: [],
  configuration: {
    pricingProfiles: [],
    customFoods: [],
    restaurants: [
      {
        id: 'friday-kbbq',
        name: 'Friday KBBQ',
        pricePerDiner: 42,
        dinerCount: 2,
        pricingProfileId: 'australian-kbbq',
        note: '',
        createdAt: AT,
        updatedAt: AT,
      },
    ],
  },
});

async function sealed(plaintext = PLAIN_BACKUP, password = PASSWORD): Promise<string> {
  const result = await encryptBackup(plaintext, password, AT);
  if (!result.ok) {
    throw new Error(`Could not encrypt the fixture: ${result.error}`);
  }
  return result.file;
}

function envelopeOf(file: string): VaultEnvelope & Record<string, unknown> {
  return JSON.parse(file) as VaultEnvelope & Record<string, unknown>;
}

describe('the envelope', () => {
  it('records every non-secret parameter needed to open it again', async () => {
    const envelope = envelopeOf(await sealed());

    expect(envelope.format).toBe(VAULT_FORMAT);
    expect(envelope.version).toBe(VAULT_VERSION);
    expect(envelope.kdf).toMatchObject({
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
    });
    expect(envelope.cipher).toMatchObject({ name: 'AES-GCM', tagBits: AES_TAG_BITS });
    expect(decodeBase64(envelope.kdf.salt)).toHaveLength(SALT_BYTES);
    expect(decodeBase64(envelope.cipher.iv)).toHaveLength(IV_BYTES);
  });

  it('stores neither the password nor the derived key', async () => {
    const file = await sealed();

    expect(file).not.toContain(PASSWORD);
    expect(file.toLowerCase()).not.toContain('password');
    expect(Object.keys(envelopeOf(file)).sort()).toEqual([
      'cipher',
      'ciphertext',
      'createdAt',
      'format',
      'kdf',
      'version',
    ]);
  });

  it('leaves nothing of the payload in the clear', async () => {
    const file = await sealed();

    expect(file).not.toContain('Friday KBBQ');
    expect(file).not.toContain(BACKUP_FORMAT);
  });

  it('uses a fresh salt and IV for every file', async () => {
    const first = envelopeOf(await sealed());
    const second = envelopeOf(await sealed());

    expect(first.kdf.salt).not.toBe(second.kdf.salt);
    expect(first.cipher.iv).not.toBe(second.cipher.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('is dated and clearly ours', () => {
    expect(vaultFilename(new Date('2026-08-16T12:00:00.000Z'))).toMatch(
      /^ayce-damage-backup-2026-08-\d{2}\.vault\.json$/,
    );
    expect(vaultFilename(new Date('not a date'))).toBe(
      'ayce-damage-backup-unknown-date.vault.json',
    );
  });
});

describe('isEncryptedBackup', () => {
  it('tells a sealed file from a plain one', async () => {
    expect(isEncryptedBackup(await sealed())).toBe(true);
    expect(isEncryptedBackup(PLAIN_BACKUP)).toBe(false);
  });

  it('says no to anything unreadable rather than throwing', () => {
    expect(isEncryptedBackup('{ not json')).toBe(false);
    expect(isEncryptedBackup('')).toBe(false);
    expect(isEncryptedBackup('x'.repeat(MAX_VAULT_BYTES + 1))).toBe(false);
  });
});

describe('parseVaultEnvelope', () => {
  async function tampered(mutate: (envelope: Record<string, unknown>) => void): Promise<string> {
    const envelope = envelopeOf(await sealed());
    mutate(envelope as Record<string, unknown>);
    return JSON.stringify(envelope);
  }

  it('accepts an envelope this build wrote', async () => {
    const parsed = parseVaultEnvelope(await sealed());
    expect(parsed.ok).toBe(true);
  });

  it('refuses a file that is not a vault', () => {
    expect(parseVaultEnvelope(PLAIN_BACKUP)).toEqual({ ok: false, error: 'not-a-vault' });
    expect(parseVaultEnvelope('{ not json')).toEqual({ ok: false, error: 'not-a-vault' });
  });

  it('refuses an oversized file before parsing it', () => {
    expect(parseVaultEnvelope('x'.repeat(MAX_VAULT_BYTES + 1))).toEqual({
      ok: false,
      error: 'too-large',
    });
  });

  it('refuses a version from a newer build', async () => {
    const file = await tampered((envelope) => {
      envelope.version = VAULT_VERSION + 1;
    });
    expect(parseVaultEnvelope(file)).toEqual({ ok: false, error: 'unsupported-version' });
  });

  it('refuses a key derivation it does not implement', async () => {
    for (const mutate of [
      (envelope: Record<string, unknown>) => {
        (envelope.kdf as Record<string, unknown>).name = 'scrypt';
      },
      (envelope: Record<string, unknown>) => {
        (envelope.kdf as Record<string, unknown>).hash = 'SHA-1';
      },
    ]) {
      expect(parseVaultEnvelope(await tampered(mutate))).toEqual({
        ok: false,
        error: 'invalid-envelope',
      });
    }
  });

  it('refuses an iteration count outside the accepted range', async () => {
    for (const iterations of [1, MIN_ACCEPTED_ITERATIONS - 1, MAX_ACCEPTED_ITERATIONS + 1, 1.5]) {
      const file = await tampered((envelope) => {
        (envelope.kdf as Record<string, unknown>).iterations = iterations;
      });
      expect(parseVaultEnvelope(file)).toEqual({ ok: false, error: 'invalid-envelope' });
    }
  });

  it('refuses a cipher it does not implement', async () => {
    const file = await tampered((envelope) => {
      (envelope.cipher as Record<string, unknown>).name = 'AES-CBC';
    });
    expect(parseVaultEnvelope(file)).toEqual({ ok: false, error: 'invalid-envelope' });
  });

  it('refuses a salt or IV of the wrong length', async () => {
    const shortSalt = await tampered((envelope) => {
      (envelope.kdf as Record<string, unknown>).salt = encodeBase64(new Uint8Array(4));
    });
    const shortIv = await tampered((envelope) => {
      (envelope.cipher as Record<string, unknown>).iv = encodeBase64(new Uint8Array(4));
    });

    expect(parseVaultEnvelope(shortSalt)).toEqual({ ok: false, error: 'invalid-envelope' });
    expect(parseVaultEnvelope(shortIv)).toEqual({ ok: false, error: 'invalid-envelope' });
  });

  it('refuses a truncated ciphertext', async () => {
    const file = await tampered((envelope) => {
      envelope.ciphertext = encodeBase64(new Uint8Array(8));
    });
    expect(parseVaultEnvelope(file)).toEqual({ ok: false, error: 'invalid-envelope' });
  });

  it('refuses parameters that are not base64 at all', async () => {
    const file = await tampered((envelope) => {
      (envelope.kdf as Record<string, unknown>).salt = 'not base64!!';
    });
    expect(parseVaultEnvelope(file)).toEqual({ ok: false, error: 'invalid-envelope' });
  });

  it('refuses an envelope missing its sections entirely', async () => {
    const file = await tampered((envelope) => {
      delete envelope.kdf;
    });
    expect(parseVaultEnvelope(file)).toEqual({ ok: false, error: 'invalid-envelope' });
  });
});

describe('encrypt and decrypt', () => {
  it('round trips the exact payload it was given', async () => {
    const opened = await decryptBackup(await sealed(), PASSWORD);

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.plaintext).toBe(PLAIN_BACKUP);
  });

  it('produces something the ordinary backup validation still accepts', async () => {
    const opened = await decryptBackup(await sealed(), PASSWORD);
    if (!opened.ok) throw new Error('decryption failed');

    const parsed = parseBackup(opened.plaintext);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.configuration.restaurants[0]?.name).toBe('Friday KBBQ');
  });

  it('retains local session tags through encrypted backup and restore parsing', async () => {
    const session: MealSession = {
      restaurantName: 'Friday KBBQ',
      pricePerDiner: 42,
      dinerCount: 1,
      items: [
        {
          id: 'beef-ribeye__standard__regular',
          foodId: 'beef-ribeye',
          quality: 'standard',
          plateSize: 'regular',
          quantity: 1,
        },
      ],
    };
    const report = buildDamageReport(session.items, session);
    const record = createSavedSession(
      session,
      report,
      getVerdict(report.totalRetailValue, report.totalAdmission),
      { id: 'encrypted-tags', createdAt: AT, tags: ['Friends', 'Birthday'] },
    );
    const plaintext = serialiseBackup(buildBackup([record], [], AT));

    const opened = await decryptBackup(await sealed(plaintext), PASSWORD);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const parsed = parseBackup(opened.plaintext);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history[0]?.tags).toEqual(['friends', 'birthday']);
  });

  it('refuses to seal a file behind a password too short to be one', async () => {
    const result = await encryptBackup(PLAIN_BACKUP, 'short', AT);
    expect(result).toEqual({ ok: false, error: 'weak-password' });
    expect('a'.repeat(MIN_VAULT_PASSWORD_LENGTH).length).toBe(MIN_VAULT_PASSWORD_LENGTH);
  });

  it('refuses a wrong password without saying which part was wrong', async () => {
    const opened = await decryptBackup(await sealed(), 'not-the-right-password');
    expect(opened).toEqual({ ok: false, error: 'wrong-password' });
  });

  it('refuses a tampered ciphertext exactly as it refuses a wrong password', async () => {
    const envelope = envelopeOf(await sealed());
    const bytes = decodeBase64(envelope.ciphertext)!;
    bytes[0] = bytes[0]! ^ 0xff;
    const file = JSON.stringify({ ...envelope, ciphertext: encodeBase64(bytes) });

    expect(await decryptBackup(file, PASSWORD)).toEqual({ ok: false, error: 'wrong-password' });
  });

  it('refuses a file whose IV was swapped for another', async () => {
    const envelope = envelopeOf(await sealed());
    const other = envelopeOf(await sealed());
    const file = JSON.stringify({
      ...envelope,
      cipher: { ...envelope.cipher, iv: other.cipher.iv },
    });

    expect(await decryptBackup(file, PASSWORD)).toEqual({ ok: false, error: 'wrong-password' });
  });

  it('refuses a file whose iteration count was lowered inside the accepted range', async () => {
    const envelope = envelopeOf(await sealed());
    const file = JSON.stringify({
      ...envelope,
      kdf: { ...envelope.kdf, iterations: MIN_ACCEPTED_ITERATIONS },
    });

    // The parameters still validate, but they derive a different key.
    expect(parseVaultEnvelope(file).ok).toBe(true);
    expect(await decryptBackup(file, PASSWORD)).toEqual({ ok: false, error: 'wrong-password' });
  });

  it('reports a malformed envelope as such rather than as a wrong password', async () => {
    expect(await decryptBackup(PLAIN_BACKUP, PASSWORD)).toEqual({
      ok: false,
      error: 'not-a-vault',
    });
    expect(await decryptBackup('{ not json', PASSWORD)).toEqual({
      ok: false,
      error: 'not-a-vault',
    });
  });

  it('says so plainly when the browser cannot do cryptography at all', async () => {
    const withoutSubtle = { getRandomValues: () => new Uint8Array(0) } as unknown as Crypto;

    expect(await encryptBackup(PLAIN_BACKUP, PASSWORD, AT, withoutSubtle)).toEqual({
      ok: false,
      error: 'crypto-unavailable',
    });
    expect(await decryptBackup(await sealed(), PASSWORD, withoutSubtle)).toEqual({
      ok: false,
      error: 'crypto-unavailable',
    });
    // A runtime with no Web Crypto object at all fails the same way.
    expect(await encryptBackup(PLAIN_BACKUP, PASSWORD, AT, {} as unknown as Crypto)).toEqual({
      ok: false,
      error: 'crypto-unavailable',
    });
  });

  it('handles a payload with characters outside the Latin range', async () => {
    const payload = JSON.stringify({ note: '한우 · 焼肉 · émincé — 🥩' });
    const opened = await decryptBackup(await sealed(payload), PASSWORD);

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.plaintext).toBe(payload);
  });

  it('opens a file encrypted with a password of its own', async () => {
    const opened = await decryptBackup(
      await sealed(PLAIN_BACKUP, 'another one entirely'),
      'another one entirely',
    );
    expect(opened.ok).toBe(true);
  });
});
