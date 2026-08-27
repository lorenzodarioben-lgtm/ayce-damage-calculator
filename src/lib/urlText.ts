/**
 * URL-safe base64 for the free text a stateless link has to carry.
 *
 * Shared by every token format in the project so they cannot drift apart, and
 * written to be total: decoding returns null for anything that is not a string
 * this module itself could have produced, and never throws.
 */

/** What `btoa` actually takes: one character per byte. */
function bytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
}

/** Standard base64, then the two substitutions that make it safe in an address. */
function toUrlSafe(binary: string): string {
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The inverse, for both URL-safe decoders.
 *
 * The alphabet is checked before `atob` rather than relying on it to object,
 * and the padding this module strips on the way out is restored on the way in.
 * Null for anything that fails either step, so neither caller has to catch.
 */
function fromUrlSafe(value: string): string | null {
  if (!/^[A-Za-z0-9\-_]+$/.test(value)) {
    return null;
  }
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    return atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  } catch {
    return null;
  }
}

export function encodeUrlText(value: string): string {
  if (value.length === 0) {
    return '';
  }
  return toUrlSafe(bytesToBinary(new TextEncoder().encode(value)));
}

export function decodeUrlText(value: string): string | null {
  if (value.length === 0) {
    return '';
  }
  const binary = fromUrlSafe(value);
  if (binary === null) {
    return null;
  }
  try {
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** URL-safe base64 over raw bytes, for the compressed share-token bodies. */
export function encodeUrlBytes(bytes: Uint8Array): string {
  return toUrlSafe(bytesToBinary(bytes));
}

/** Returns null for anything outside the URL-safe alphabet, and never throws. */
export function decodeUrlBytes(value: string): Uint8Array | null {
  if (value.length === 0) {
    return new Uint8Array(0);
  }
  const binary = fromUrlSafe(value);
  return binary === null ? null : Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * Standard base64 for binary, used by the encrypted-backup envelope.
 *
 * Kept alongside the URL-safe pair because they solve the same problem in two
 * places, and separating them would make it easy to reach for the wrong one:
 * a file's envelope wants ordinary base64, an address wants the URL-safe form.
 */
export function encodeBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes));
}

/** Returns null for anything that is not base64 this module could have written. */
export function decodeBase64(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return null;
  }
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}
