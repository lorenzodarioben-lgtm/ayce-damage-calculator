import { describe, expect, it } from 'vitest';
import {
  decodeBase64,
  decodeUrlBytes,
  decodeUrlText,
  encodeBase64,
  encodeUrlBytes,
  encodeUrlText,
} from '@/lib/urlText';

/*
 * Every share token in the project passes through these four pairs, and the
 * suites that exercise them today do so through a token format. Testing them
 * directly pins the contract those formats rely on: a round trip is lossless,
 * and anything this module could not have written decodes to null rather than
 * throwing.
 */

const SAMPLES = [
  'Seoul Garden',
  'Kim, Lee & Co',
  'Ünïcödé ☕ 焼肉',
  '"quoted" / slashed + plussed',
  'a'.repeat(2048),
];

describe('encodeUrlText and decodeUrlText', () => {
  it('round-trips text, including characters a URL would otherwise mangle', () => {
    for (const sample of SAMPLES) {
      expect(decodeUrlText(encodeUrlText(sample))).toBe(sample);
    }
  });

  it('stays inside the URL-safe alphabet, with no padding to escape', () => {
    for (const sample of SAMPLES) {
      expect(encodeUrlText(sample)).toMatch(/^[A-Za-z0-9\-_]*$/);
    }
  });

  it('treats empty as empty in both directions', () => {
    expect(encodeUrlText('')).toBe('');
    expect(decodeUrlText('')).toBe('');
  });

  it('refuses anything outside the alphabet rather than guessing', () => {
    for (const value of ['not base64!', 'has spaces', 'a+b', 'a/b', 'padded==']) {
      expect(decodeUrlText(value)).toBeNull();
    }
  });

  it('refuses bytes that are not valid UTF-8', () => {
    // A lone continuation byte: decodable as base64, meaningless as text.
    expect(decodeUrlText(encodeUrlBytes(new Uint8Array([0x80])))).toBeNull();
  });
});

describe('encodeUrlBytes and decodeUrlBytes', () => {
  it('round-trips arbitrary bytes, including every value a byte can hold', () => {
    const bytes = new Uint8Array(256).map((_, index) => index);

    expect(decodeUrlBytes(encodeUrlBytes(bytes))).toEqual(bytes);
  });

  it('treats empty as empty in both directions', () => {
    expect(encodeUrlBytes(new Uint8Array(0))).toBe('');
    expect(decodeUrlBytes('')).toEqual(new Uint8Array(0));
  });

  it('refuses anything outside the alphabet rather than throwing', () => {
    expect(decodeUrlBytes('a b c')).toBeNull();
    expect(decodeUrlBytes('=====')).toBeNull();
  });
});

describe('encodeBase64 and decodeBase64', () => {
  it('round-trips bytes in the padded form a backup envelope carries', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const encoded = encodeBase64(bytes);

    expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(decodeBase64(encoded)).toEqual(bytes);
  });

  it('rejects a length that standard base64 could never have produced', () => {
    // Five characters cannot be a whole number of encoded groups.
    expect(decodeBase64('AAAAA')).toBeNull();
  });

  it('rejects anything that is not a non-empty base64 string', () => {
    for (const value of [null, undefined, 42, {}, '', 'a-b_c']) {
      expect(decodeBase64(value)).toBeNull();
    }
  });
});
