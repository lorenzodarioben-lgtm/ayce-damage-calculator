/**
 * URL-safe base64 for the free text a stateless link has to carry.
 *
 * Shared by every token format in the project so they cannot drift apart, and
 * written to be total: decoding returns null for anything that is not a string
 * this module itself could have produced, and never throws.
 */

export function encodeUrlText(value: string): string {
  if (value.length === 0) {
    return '';
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeUrlText(value: string): string | null {
  if (value.length === 0) {
    return '';
  }
  if (!/^[A-Za-z0-9\-_]+$/.test(value)) {
    return null;
  }
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
