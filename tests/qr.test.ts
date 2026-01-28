import { describe, expect, it } from 'vitest';
import { MAX_QR_TEXT_LENGTH, buildQrMatrix, qrPath } from '@/lib/qr';

describe('buildQrMatrix', () => {
  it('encodes a link into a square matrix', () => {
    const matrix = buildQrMatrix('https://example.test/menu/1.abcdef');

    expect(matrix).not.toBeNull();
    expect(matrix!.size).toBeGreaterThan(20);
    expect(matrix!.modules).toHaveLength(matrix!.size * matrix!.size);
  });

  it('is deterministic for the same text', () => {
    expect(buildQrMatrix('same text')).toEqual(buildQrMatrix('same text'));
  });

  it('places the three finder patterns every reader looks for', () => {
    const matrix = buildQrMatrix('https://example.test/menu/1.abcdef')!;
    const dark = (row: number, column: number) => matrix.modules[row * matrix.size + column];

    // The corner module of each finder pattern is dark in every valid code.
    expect(dark(0, 0)).toBe(true);
    expect(dark(0, matrix.size - 1)).toBe(true);
    expect(dark(matrix.size - 1, 0)).toBe(true);
    // The fourth corner never carries one.
    expect(dark(matrix.size - 1, matrix.size - 1)).toBe(false);
  });

  it('grows with the amount of data', () => {
    const small = buildQrMatrix('short')!;
    const large = buildQrMatrix('x'.repeat(400))!;

    expect(large.size).toBeGreaterThan(small.size);
  });

  it('returns nothing for text it cannot usefully encode', () => {
    expect(buildQrMatrix('')).toBeNull();
    expect(buildQrMatrix('x'.repeat(MAX_QR_TEXT_LENGTH + 1))).toBeNull();
  });

  it('never throws, however long the text', () => {
    expect(() => buildQrMatrix('x'.repeat(100_000))).not.toThrow();
  });
});

describe('qrPath', () => {
  it('draws one square per dark module', () => {
    const matrix = buildQrMatrix('https://example.test/menu/1.abcdef')!;
    const dark = matrix.modules.filter(Boolean).length;

    expect(qrPath(matrix).match(/M/g)).toHaveLength(dark);
  });

  it('produces an empty path for a matrix with nothing dark', () => {
    expect(qrPath({ size: 2, modules: [false, false, false, false] })).toBe('');
  });
});
