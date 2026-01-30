import { describe, expect, it } from 'vitest';
import { LZSS_MAX_MATCH, LZSS_WINDOW, lzssCompress, lzssDecompress } from '@/lib/lzss';

/**
 * The compressor is a trust boundary as much as a size optimisation: a share
 * token is bytes a stranger controls, so decoding is tested for what it refuses
 * as carefully as for what it reproduces.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function roundTrip(text: string): string | null {
  const raw = encoder.encode(text);
  const out = lzssDecompress(lzssCompress(raw), raw.length);
  return out === null ? null : decoder.decode(out);
}

/** Deterministic pseudo-random bytes, so a failure is always reproducible. */
function noise(length: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let state = seed;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    bytes[index] = state % 256;
  }
  return bytes;
}

describe('LZSS round trips', () => {
  it('reproduces the empty input', () => {
    expect(lzssCompress(new Uint8Array(0))).toHaveLength(0);
    expect(lzssDecompress(new Uint8Array(0), 0)).toEqual(new Uint8Array(0));
  });

  it.each([
    ['a single byte', 'a'],
    ['shorter than the minimum match', 'ab'],
    ['exactly the minimum match', 'abc'],
    ['a long run of one byte', 'x'.repeat(5000)],
    ['a repeating phrase', 'the same words again and again '.repeat(200)],
    ['ordinary prose', 'A late-night Korean barbecue tab, recorded plate by plate.'],
    ['multi-byte characters', '한국식 바베큐 🥩🔥 '.repeat(50)],
    [
      'every byte value',
      Array.from({ length: 256 }, (_unused, index) => String.fromCharCode(index)).join(''),
    ],
  ])('reproduces %s', (_label, text) => {
    expect(roundTrip(text)).toBe(text);
  });

  it('reproduces incompressible bytes', () => {
    const raw = noise(4096, 7);
    expect(lzssDecompress(lzssCompress(raw), raw.length)).toEqual(raw);
  });

  it('reproduces input longer than the window', () => {
    const raw = encoder.encode('block-'.repeat(LZSS_WINDOW));
    const out = lzssDecompress(lzssCompress(raw), raw.length);
    // Compared as plain arrays: TextEncoder hands back a Uint8Array from the
    // host realm, which jsdom's own is not structurally equal to.
    expect(Array.from(out ?? [])).toEqual(Array.from(raw));
  });

  it('reproduces a match at exactly the maximum length', () => {
    const unit = 'abcdefghijklmnopqr'.slice(0, LZSS_MAX_MATCH);
    expect(roundTrip(`${unit}${unit}`)).toBe(`${unit}${unit}`);
  });
});

describe('LZSS actually compresses', () => {
  it('shrinks repetitive text substantially', () => {
    const raw = encoder.encode(
      JSON.stringify({
        items: Array(40).fill({
          foodId: 'beef-ribeye',
          quality: 'standard',
          plateSize: 'regular',
          quantity: 2,
        }),
      }),
    );
    expect(lzssCompress(raw).length).toBeLessThan(raw.length / 4);
  });

  it('never expands incompressible input beyond its control overhead', () => {
    const raw = noise(2048, 11);
    // One control byte carries eight literals, so the worst case is a ninth.
    expect(lzssCompress(raw).length).toBeLessThanOrEqual(raw.length + Math.ceil(raw.length / 8));
  });
});

describe('LZSS is deterministic', () => {
  it('produces identical bytes for identical input', () => {
    const raw = encoder.encode('repeat '.repeat(300));
    expect(lzssCompress(raw)).toEqual(lzssCompress(raw));
  });

  it('produces identical bytes for a separately built copy of the same input', () => {
    const text = JSON.stringify({ a: 'value', b: ['value', 'value', 'value'] });
    expect(lzssCompress(encoder.encode(text))).toEqual(lzssCompress(encoder.encode(text)));
  });
});

describe('LZSS refuses what it cannot trust', () => {
  it('rejects a stream that would write past the declared length', () => {
    const raw = encoder.encode('x'.repeat(400));
    expect(lzssDecompress(lzssCompress(raw), 10)).toBeNull();
  });

  it('rejects a stream that stops short of the declared length', () => {
    const raw = encoder.encode('x'.repeat(400));
    expect(lzssDecompress(lzssCompress(raw), 4000)).toBeNull();
  });

  it('rejects a back-reference pointing before the start of the output', () => {
    // Control byte says "one match", and the match reaches back past byte zero.
    expect(lzssDecompress(Uint8Array.from([0b0000_0001, 0x10, 0x00]), 64)).toBeNull();
  });

  it('rejects a truncated match', () => {
    expect(lzssDecompress(Uint8Array.from([0b0000_0001, 0x00]), 64)).toBeNull();
  });

  it('rejects a negative or absurd expected length', () => {
    expect(lzssDecompress(new Uint8Array(0), -1)).toBeNull();
    expect(lzssDecompress(new Uint8Array(0), 1.5)).toBeNull();
    expect(lzssDecompress(new Uint8Array(0), Number.NaN)).toBeNull();
  });

  it('never throws on arbitrary bytes, whatever length is claimed', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const bytes = noise(seed * 7, seed);
      for (const expected of [0, 8, 64, 1024]) {
        expect(() => lzssDecompress(bytes, expected)).not.toThrow();
      }
    }
  });
});
