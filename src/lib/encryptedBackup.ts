import { decodeBase64, encodeBase64 } from '@/lib/urlText';

/**
 * Password-encrypted backups, using the browser's own cryptography.
 *
 * There is no invented algorithm here and no key material stored anywhere. The
 * design is the ordinary one: a random salt, a password-derived key through
 * PBKDF2, a random IV, and AES-GCM — which authenticates as well as encrypts,
 * so a file altered in transit fails to open rather than decrypting to
 * something plausible.
 *
 * The password is never written down, never persisted, never logged and never
 * put in an error. Nor could it be: it exists only inside the call that derives
 * a key from it, and this app has no analytics to leak it into.
 *
 * Everything except the key is stored in the clear in the envelope, because it
 * has to be: a salt and an IV are public parameters, and recording them
 * explicitly is what lets a later version recognise or migrate the format
 * instead of guessing at it.
 */

export const VAULT_FORMAT = 'ayce-damage-vault';

/** 1 — PBKDF2-SHA-256 into AES-256-GCM. */
export const VAULT_VERSION = 1;

/**
 * OWASP's current floor for PBKDF2-HMAC-SHA-256. Deliberately slow: the whole
 * point is that guessing the password costs the guesser real time.
 */
export const PBKDF2_ITERATIONS = 310_000;

/** The lowest iteration count this build will open a file with. */
export const MIN_ACCEPTED_ITERATIONS = 100_000;
export const MAX_ACCEPTED_ITERATIONS = 5_000_000;

export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const AES_KEY_BITS = 256;
export const AES_TAG_BITS = 128;

/**
 * Short enough not to be a barrier, long enough to be worth deriving a key
 * from. Stated in the interface rather than enforced silently.
 */
export const MIN_VAULT_PASSWORD_LENGTH = 8;

/** Base64 inflates by a third, so this leaves room for the largest plain backup. */
export const MAX_VAULT_BYTES = 12 * 1024 * 1024;

export type VaultError =
  | 'too-large'
  | 'not-a-vault'
  | 'unsupported-version'
  | 'invalid-envelope'
  | 'weak-password'
  | 'wrong-password'
  | 'crypto-unavailable';

/**
 * Deliberately incurious messages.
 *
 * A wrong password and a tampered file are the same failure to AES-GCM, and
 * saying which one it was would be guessing. Nothing here names an internal
 * detail either — an error a user reads should tell them what to do next, not
 * describe the cipher.
 */
export const VAULT_ERROR_MESSAGES: Readonly<Record<VaultError, string>> = {
  'too-large': 'That file is too large to be an AYCE backup.',
  'not-a-vault': 'That file is not an encrypted AYCE backup.',
  'unsupported-version': 'That backup was encrypted by a newer version of the calculator.',
  'invalid-envelope': 'That encrypted backup is incomplete or damaged.',
  'weak-password': `Use at least ${MIN_VAULT_PASSWORD_LENGTH} characters.`,
  'wrong-password': 'That password did not open this backup, or the file has been altered.',
  'crypto-unavailable': 'This browser cannot encrypt or decrypt backups.',
};

export interface VaultEnvelope {
  readonly format: typeof VAULT_FORMAT;
  readonly version: number;
  readonly createdAt: string;
  readonly kdf: {
    readonly name: 'PBKDF2';
    readonly hash: 'SHA-256';
    readonly iterations: number;
    readonly salt: string;
  };
  readonly cipher: {
    readonly name: 'AES-GCM';
    readonly iv: string;
    readonly tagBits: number;
  };
  readonly ciphertext: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether a file is an encrypted backup at all.
 *
 * Cheap and total: import can decide whether to ask for a password before it
 * asks the user for anything.
 */
export function isEncryptedBackup(raw: string): boolean {
  if (raw.length > MAX_VAULT_BYTES) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && parsed.format === VAULT_FORMAT;
  } catch {
    return false;
  }
}

export type EnvelopeResult =
  | { readonly ok: true; readonly envelope: VaultEnvelope }
  | { readonly ok: false; readonly error: VaultError };

/**
 * Validates the envelope without touching the ciphertext.
 *
 * Every cryptographic parameter is checked against what this build actually
 * supports, so a hand-edited iteration count of one, an IV of the wrong length
 * or an unknown hash fails here rather than producing a key nobody intended.
 */
export function parseVaultEnvelope(raw: string): EnvelopeResult {
  if (raw.length > MAX_VAULT_BYTES) {
    return { ok: false, error: 'too-large' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'not-a-vault' };
  }

  if (!isRecord(parsed) || parsed.format !== VAULT_FORMAT) {
    return { ok: false, error: 'not-a-vault' };
  }
  if (typeof parsed.version !== 'number' || parsed.version < 1) {
    return { ok: false, error: 'invalid-envelope' };
  }
  if (parsed.version > VAULT_VERSION) {
    return { ok: false, error: 'unsupported-version' };
  }

  const kdf = parsed.kdf;
  const cipher = parsed.cipher;
  if (!isRecord(kdf) || !isRecord(cipher)) {
    return { ok: false, error: 'invalid-envelope' };
  }
  if (kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') {
    return { ok: false, error: 'invalid-envelope' };
  }
  if (
    typeof kdf.iterations !== 'number' ||
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations < MIN_ACCEPTED_ITERATIONS ||
    kdf.iterations > MAX_ACCEPTED_ITERATIONS
  ) {
    return { ok: false, error: 'invalid-envelope' };
  }
  if (cipher.name !== 'AES-GCM' || cipher.tagBits !== AES_TAG_BITS) {
    return { ok: false, error: 'invalid-envelope' };
  }

  const salt = decodeBase64(kdf.salt);
  const iv = decodeBase64(cipher.iv);
  const ciphertext = decodeBase64(parsed.ciphertext);
  if (!salt || salt.length !== SALT_BYTES) {
    return { ok: false, error: 'invalid-envelope' };
  }
  if (!iv || iv.length !== IV_BYTES) {
    return { ok: false, error: 'invalid-envelope' };
  }
  // Shorter than the authentication tag alone means the file is truncated.
  if (!ciphertext || ciphertext.length <= AES_TAG_BITS / 8) {
    return { ok: false, error: 'invalid-envelope' };
  }

  return {
    ok: true,
    envelope: {
      format: VAULT_FORMAT,
      version: parsed.version,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: kdf.iterations,
        salt: kdf.salt as string,
      },
      cipher: { name: 'AES-GCM', iv: cipher.iv as string, tagBits: AES_TAG_BITS },
      ciphertext: parsed.ciphertext as string,
    },
  };
}

function subtleOf(source: Crypto | undefined): SubtleCrypto | null {
  return source?.subtle ?? null;
}

async function deriveKey(
  crypto: Crypto,
  password: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    // Never extractable: the derived key exists only for this operation.
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    [usage],
  );
}

export type EncryptResult =
  | { readonly ok: true; readonly file: string }
  | { readonly ok: false; readonly error: VaultError };

/**
 * Encrypts an already-validated backup payload.
 *
 * Takes the serialised plain backup rather than building one, so the encrypted
 * and unencrypted exports are provably the same bytes with one of them wrapped.
 */
export async function encryptBackup(
  plaintext: string,
  password: string,
  createdAt: string,
  source: Crypto | undefined = globalThis.crypto,
): Promise<EncryptResult> {
  if (password.length < MIN_VAULT_PASSWORD_LENGTH) {
    return { ok: false, error: 'weak-password' };
  }
  if (!source || !subtleOf(source)) {
    return { ok: false, error: 'crypto-unavailable' };
  }

  try {
    const salt = source.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = source.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(source, password, salt, PBKDF2_ITERATIONS, 'encrypt');
    const ciphertext = await source.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, tagLength: AES_TAG_BITS },
      key,
      new TextEncoder().encode(plaintext),
    );

    const envelope: VaultEnvelope = {
      format: VAULT_FORMAT,
      version: VAULT_VERSION,
      createdAt,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: encodeBase64(salt),
      },
      cipher: { name: 'AES-GCM', iv: encodeBase64(iv), tagBits: AES_TAG_BITS },
      ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    };

    return { ok: true, file: JSON.stringify(envelope, null, 2) };
  } catch {
    // Nothing about the failure is reported onward: it would say more about the
    // password than about the problem.
    return { ok: false, error: 'crypto-unavailable' };
  }
}

export type DecryptResult =
  | { readonly ok: true; readonly plaintext: string }
  | { readonly ok: false; readonly error: VaultError };

/**
 * Opens an encrypted backup, or fails without saying why in detail.
 *
 * A wrong password and a tampered ciphertext are indistinguishable to an
 * authenticated cipher, and pretending otherwise would be inventing a
 * distinction the mathematics does not make.
 */
export async function decryptBackup(
  raw: string,
  password: string,
  source: Crypto | undefined = globalThis.crypto,
): Promise<DecryptResult> {
  const parsed = parseVaultEnvelope(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  if (!source || !subtleOf(source)) {
    return { ok: false, error: 'crypto-unavailable' };
  }

  const salt = decodeBase64(parsed.envelope.kdf.salt);
  const iv = decodeBase64(parsed.envelope.cipher.iv);
  const ciphertext = decodeBase64(parsed.envelope.ciphertext);
  if (!salt || !iv || !ciphertext) {
    return { ok: false, error: 'invalid-envelope' };
  }

  try {
    const key = await deriveKey(source, password, salt, parsed.envelope.kdf.iterations, 'decrypt');
    const plaintext = await source.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, tagLength: AES_TAG_BITS },
      key,
      ciphertext as BufferSource,
    );
    return { ok: true, plaintext: new TextDecoder().decode(plaintext) };
  } catch {
    return { ok: false, error: 'wrong-password' };
  }
}

/** `ayce-damage-backup-2026-08-16.vault.json` */
export function vaultFilename(date: Date): string {
  const stamp = Number.isNaN(date.getTime())
    ? 'unknown-date'
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `ayce-damage-backup-${stamp}.vault.json`;
}
