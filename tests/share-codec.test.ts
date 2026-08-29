import { describe, expect, it } from 'vitest';
import { packShareBody, unpackShareBody, type PackLimits } from '@/lib/shareCodec';
import { encodeUrlBytes } from '@/lib/urlText';

const LIMITS: PackLimits = { maxDecodedBytes: 16 * 1024, maxEncodedLength: 4096 };

/** Deterministic pseudo-random text, so nothing here depends on a lucky run. */
function incompressible(length: number, seed: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = seed;
  let text = '';
  for (let index = 0; index < length; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    text += alphabet[state % alphabet.length];
  }
  return text;
}

describe('Packing a share body', () => {
  it.each([
    ['an object', '{"a":1}'],
    [
      'deeply repetitive JSON',
      JSON.stringify({ items: Array(30).fill({ foodId: 'beef-ribeye', quality: 'standard' }) }),
    ],
    ['text outside the basic plane', JSON.stringify({ name: '한국식 바베큐 🥩🔥' })],
    ['a lone quote mark', '"\\""'],
    ['the smallest legal document', '0'],
  ])('round trips %s', (_label, json) => {
    const packed = packShareBody(json, LIMITS);
    expect(packed).not.toBeNull();
    expect(unpackShareBody(packed as string, LIMITS)).toBe(json);
  });

  it('stays inside the URL-safe alphabet', () => {
    const packed = packShareBody(JSON.stringify({ name: '한국식 🔥', n: 1 }), LIMITS);
    expect(packed).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic for identical canonical input', () => {
    const json = JSON.stringify({ restaurantName: 'Seoul Garden', items: [1, 2, 3] });
    expect(packShareBody(json, LIMITS)).toBe(packShareBody(json, LIMITS));
  });

  it('compresses a repetitive document well below its raw size', () => {
    const json = JSON.stringify({ lines: Array(60).fill('beef-ribeye standard regular') });
    expect((packShareBody(json, LIMITS) as string).length).toBeLessThan(json.length / 4);
  });

  it('stores rather than compresses when compression would not help', () => {
    // Still a perfect round trip, which is the only guarantee callers rely on.
    const json = JSON.stringify({ v: incompressible(64, 3) });
    const packed = packShareBody(json, LIMITS);
    expect(unpackShareBody(packed as string, LIMITS)).toBe(json);
  });
});

describe('Size limits are applied before anything is trusted', () => {
  it('refuses a document larger than the decoded ceiling', () => {
    const json = JSON.stringify({ v: 'x'.repeat(LIMITS.maxDecodedBytes) });
    expect(packShareBody(json, LIMITS)).toBeNull();
  });

  it('accepts a document exactly at the decoded ceiling', () => {
    // Two bytes of JSON syntax around the payload, so the whole document lands
    // precisely on the limit rather than one byte over it.
    const json = `"${'a'.repeat(LIMITS.maxDecodedBytes - 2)}"`;
    expect(new TextEncoder().encode(json)).toHaveLength(LIMITS.maxDecodedBytes);
    expect(unpackShareBody(packShareBody(json, LIMITS) as string, LIMITS)).toBe(json);
  });

  it('refuses a body longer than the encoded ceiling', () => {
    const tight: PackLimits = { maxDecodedBytes: 16 * 1024, maxEncodedLength: 32 };
    expect(packShareBody(JSON.stringify({ v: incompressible(400, 5) }), tight)).toBeNull();
  });

  it('refuses a body whose declared length exceeds the ceiling, without decoding it', () => {
    // Mode 1, then a varint claiming a gigabyte. Nothing follows it, because
    // nothing should ever be read: the claim alone is disqualifying.
    const hostile = encodeUrlBytes(Uint8Array.from([1, 0x80, 0x80, 0x80, 0x04]));
    expect(unpackShareBody(hostile, LIMITS)).toBeNull();
  });

  it('refuses a varint longer than the codec ever writes', () => {
    const hostile = encodeUrlBytes(Uint8Array.from([1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01]));
    expect(unpackShareBody(hostile, LIMITS)).toBeNull();
  });
});

describe('Unpacking refuses what it cannot trust', () => {
  it.each([
    ['an empty body', ''],
    ['characters outside the alphabet', 'not a token!'],
    ['a body too short to hold a header', encodeUrlBytes(Uint8Array.from([1]))],
    ['an unknown mode byte', encodeUrlBytes(Uint8Array.from([9, 4, 0x7b, 0x7d, 0x7b, 0x7d]))],
    ['a stored body shorter than it claims', encodeUrlBytes(Uint8Array.from([0, 40, 0x7b]))],
    ['a stored body longer than it claims', encodeUrlBytes(Uint8Array.from([0, 1, 0x7b, 0x7d]))],
  ])('returns null for %s', (_label, body) => {
    expect(unpackShareBody(body, LIMITS)).toBeNull();
  });

  it('returns null for bytes that are not valid UTF-8', () => {
    // A lone continuation byte, stored verbatim and honestly length-prefixed.
    expect(unpackShareBody(encodeUrlBytes(Uint8Array.from([0, 1, 0x80])), LIMITS)).toBeNull();
  });

  it('never throws on arbitrary URL-safe input', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let state = 42;
    for (let attempt = 0; attempt < 400; attempt += 1) {
      let body = '';
      for (let index = 0; index < (attempt % 60) + 1; index += 1) {
        state = (state * 1103515245 + 12345) % 2147483648;
        body += alphabet[state % alphabet.length];
      }
      expect(() => unpackShareBody(body, LIMITS)).not.toThrow();
    }
  });

  it('rejects a body that was truncated in transit', () => {
    const packed = packShareBody(
      JSON.stringify({ lines: Array(40).fill('repeated') }),
      LIMITS,
    ) as string;
    for (const cut of [1, 4, 12, Math.floor(packed.length / 2), packed.length - 1]) {
      expect(() => unpackShareBody(packed.slice(0, cut), LIMITS)).not.toThrow();
    }
  });
});
