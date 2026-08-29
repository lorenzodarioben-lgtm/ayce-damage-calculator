import { lzssCompress, lzssDecompress } from '@/lib/lzss';
import { decodeUrlBytes, encodeUrlBytes } from '@/lib/urlText';

/**
 * The packing layer shared by every compressed share token.
 *
 * One codec serves reports, menus and Damage Challenges, because they are the
 * same problem: a JSON document that has to survive a round trip through an
 * address bar, from a device that may be a phone or a server-rendered Open
 * Graph route, with no database anywhere in between. Keeping it in one place is
 * also what keeps the three formats from drifting into three sets of subtly
 * different bounds.
 *
 * The body is a byte string, base64url encoded:
 *
 *   [0]      mode — 0 stored, 1 compressed
 *   [1..]    the decoded length, as a 7-bit varint
 *   [...]    the payload, compressed or not
 *
 * Carrying the decoded length explicitly is the point of the header. It lets a
 * decoder compare a claimed size against its ceiling and refuse the token
 * *before* allocating anything, which is the difference between a bounded
 * decoder and one that discovers it is out of memory.
 */

/** Stored rather than compressed, for the payloads compression cannot improve. */
const MODE_STORED = 0;
const MODE_COMPRESSED = 1;

/** A varint long enough for any size this project accepts, and no longer. */
const MAX_VARINT_BYTES = 5;

export interface PackLimits {
  /** The largest JSON document that may be packed or unpacked, in bytes. */
  readonly maxDecodedBytes: number;
  /** The largest packed body accepted, in base64url characters. */
  readonly maxEncodedLength: number;
}

function writeVarint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  do {
    const septet = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    bytes.push(remaining > 0 ? septet | 0x80 : septet);
  } while (remaining > 0);
  return bytes;
}

interface Varint {
  readonly value: number;
  readonly bytesRead: number;
}

function readVarint(bytes: Uint8Array, from: number): Varint | null {
  let value = 0;
  let shift = 1;
  for (let index = 0; index < MAX_VARINT_BYTES; index += 1) {
    const byte = bytes[from + index];
    if (byte === undefined) {
      return null;
    }
    value += (byte & 0x7f) * shift;
    if ((byte & 0x80) === 0) {
      return { value, bytesRead: index + 1 };
    }
    shift *= 128;
  }
  // Longer than five bytes is not a number this codec ever wrote.
  return null;
}

/**
 * Packs a JSON document into a URL-safe body, or returns null when it will not
 * fit inside the limits the caller set.
 *
 * The stored/compressed choice is made on size alone and settled here, so the
 * token version stays stable and identical canonical input always produces an
 * identical body.
 */
export function packShareBody(json: string, limits: PackLimits): string | null {
  const raw = new TextEncoder().encode(json);
  if (raw.length > limits.maxDecodedBytes) {
    return null;
  }

  const compressed = lzssCompress(raw);
  const useCompressed = compressed.length < raw.length;
  const payload = useCompressed ? compressed : raw;

  const header = [useCompressed ? MODE_COMPRESSED : MODE_STORED, ...writeVarint(raw.length)];
  const body = new Uint8Array(header.length + payload.length);
  body.set(header, 0);
  body.set(payload, header.length);

  const encoded = encodeUrlBytes(body);
  return encoded.length <= limits.maxEncodedLength ? encoded : null;
}

/**
 * Unpacks a body written by `packShareBody`, or returns null.
 *
 * Every gate is applied in order of cost: the address length first, then the
 * alphabet, then the declared size, and only then any decompression. Nothing
 * about the payload is believed until the byte that describes it has been
 * checked against a fixed ceiling.
 */
export function unpackShareBody(body: string, limits: PackLimits): string | null {
  if (typeof body !== 'string' || body.length === 0 || body.length > limits.maxEncodedLength) {
    return null;
  }

  const bytes = decodeUrlBytes(body);
  if (bytes === null || bytes.length < 2) {
    return null;
  }

  const mode = bytes[0];
  if (mode !== MODE_STORED && mode !== MODE_COMPRESSED) {
    return null;
  }

  const declared = readVarint(bytes, 1);
  if (declared === null || declared.value > limits.maxDecodedBytes) {
    return null;
  }

  const payload = bytes.subarray(1 + declared.bytesRead);
  let decoded: Uint8Array | null;

  if (mode === MODE_STORED) {
    // A stored body must be exactly as long as it says it is; a mismatch means
    // the header and the payload disagree, and neither can be trusted.
    decoded = payload.length === declared.value ? payload : null;
  } else {
    decoded = lzssDecompress(payload, declared.value);
  }

  if (decoded === null) {
    return null;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(decoded);
  } catch {
    return null;
  }
}

/**
 * Why a payload could not be turned into a link.
 *
 * Worth distinguishing, because the two have opposite remedies: an empty tab
 * needs food on it, an oversized one needs fewer lines. Collapsing both into
 * null is what let a full tab be reported as an empty one.
 */
export type ShareEncodeFailure = 'empty' | 'too-large';

export type ShareEncodeResult =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly reason: ShareEncodeFailure };

export function shareEncodeFailure(reason: ShareEncodeFailure): ShareEncodeResult {
  return { ok: false, reason };
}

export function shareEncodeSuccess(token: string): ShareEncodeResult {
  return { ok: true, token };
}

/** Narrows a result to the token, for the callers that only need the happy path. */
export function shareTokenOrNull(result: ShareEncodeResult): string | null {
  return result.ok ? result.token : null;
}
