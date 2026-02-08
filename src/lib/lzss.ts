/**
 * A small, deterministic LZSS codec for the stateless share tokens.
 *
 * Share links carry their whole payload in the address, so the only way to fit
 * a bigger meal into one is to make the bytes smaller. The obvious route —
 * `CompressionStream` — is asynchronous, is absent from some engines this
 * project already supports, and gives no guarantee that two builds of zlib
 * agree byte for byte. A token has to be reproducible: the same canonical meal
 * has to produce the same address on a phone, on a laptop and inside a
 * server-rendered Open Graph route. So the compressor is written here, in a
 * hundred lines of arithmetic, where the output depends on nothing but the
 * input.
 *
 * Decoding is the trust boundary. Every back-reference is validated against
 * what has actually been produced so far, output is written into a buffer the
 * caller has already sized, and the decoder stops the moment it would exceed
 * it — so a hostile token cannot make this allocate, loop or read out of
 * bounds. It never throws; it returns null.
 */

/** 12-bit offsets. Large enough for the repetition JSON payloads actually have. */
export const LZSS_WINDOW = 4096;

/** Below this a back-reference costs more than the bytes it replaces. */
export const LZSS_MIN_MATCH = 3;

/** 4-bit length codes, biased by the minimum: 0 means 3, 15 means 18. */
export const LZSS_MAX_MATCH = LZSS_MIN_MATCH + 15;

/**
 * How far back a candidate chain is followed before the search settles.
 *
 * A fixed bound rather than an exhaustive scan, so compressing a hostile input
 * costs the same as compressing an ordinary one — and so the chosen match is a
 * function of the input alone, never of how long the machine was willing to
 * look.
 */
const MAX_CHAIN = 64;

function hashAt(bytes: Uint8Array, index: number): number {
  return (
    (((bytes[index] as number) << 16) |
      ((bytes[index + 1] as number) << 8) |
      (bytes[index + 2] as number)) >>>
    0
  );
}

interface Match {
  readonly offset: number;
  readonly length: number;
}

/**
 * The longest match ending no further back than the window.
 *
 * Candidates are walked newest first and a strictly longer match is required to
 * displace the incumbent, so ties resolve to the nearest occurrence. That rule
 * is what makes the result unique for a given input.
 */
function findMatch(bytes: Uint8Array, at: number, chain: readonly number[]): Match | null {
  const limit = Math.min(LZSS_MAX_MATCH, bytes.length - at);
  if (limit < LZSS_MIN_MATCH) {
    return null;
  }

  let best: Match | null = null;
  let examined = 0;

  for (let index = chain.length - 1; index >= 0 && examined < MAX_CHAIN; index -= 1) {
    examined += 1;
    const candidate = chain[index] as number;
    const offset = at - candidate;
    if (offset <= 0 || offset > LZSS_WINDOW) {
      // The chain is ordered, so everything earlier is further away still.
      break;
    }

    let length = 0;
    while (length < limit && bytes[candidate + length] === bytes[at + length]) {
      length += 1;
    }

    if (length >= LZSS_MIN_MATCH && (best === null || length > best.length)) {
      best = { offset, length };
      if (length === limit) {
        break;
      }
    }
  }

  return best;
}

/**
 * Compresses bytes into literals and back-references.
 *
 * The stream is a repeating group of one control byte and up to eight items.
 * Each control bit says whether the corresponding item is a literal byte or a
 * two-byte reference, read least-significant bit first.
 */
export function lzssCompress(bytes: Uint8Array): Uint8Array {
  const output: number[] = [];
  const chains = new Map<number, number[]>();

  let controlIndex = -1;
  let controlBit = 8;

  const remember = (index: number) => {
    if (index + LZSS_MIN_MATCH > bytes.length) {
      return;
    }
    const key = hashAt(bytes, index);
    const chain = chains.get(key);
    if (chain) {
      chain.push(index);
      // Only the window is reachable, so an unbounded chain is wasted memory.
      if (chain.length > MAX_CHAIN * 2) {
        chain.splice(0, chain.length - MAX_CHAIN);
      }
    } else {
      chains.set(key, [index]);
    }
  };

  let at = 0;
  while (at < bytes.length) {
    if (controlBit === 8) {
      controlIndex = output.length;
      output.push(0);
      controlBit = 0;
    }

    const chain = at + LZSS_MIN_MATCH <= bytes.length ? (chains.get(hashAt(bytes, at)) ?? []) : [];
    const match = findMatch(bytes, at, chain);

    if (match) {
      output[controlIndex] = (output[controlIndex] as number) | (1 << controlBit);
      const encodedOffset = match.offset - 1;
      output.push(encodedOffset & 0xff);
      output.push(((encodedOffset >> 8) << 4) | (match.length - LZSS_MIN_MATCH));
      for (let step = 0; step < match.length; step += 1) {
        remember(at + step);
      }
      at += match.length;
    } else {
      output.push(bytes[at] as number);
      remember(at);
      at += 1;
    }

    controlBit += 1;
  }

  return Uint8Array.from(output);
}

/**
 * Rebuilds the original bytes, or returns null.
 *
 * `expected` is the length the caller has already accepted, so the output
 * buffer is allocated once at a size that was bounded before any of this token
 * was trusted. A stream that would write past it, or that finishes short of it,
 * is rejected rather than half-decoded.
 */
export function lzssDecompress(bytes: Uint8Array, expected: number): Uint8Array | null {
  if (!Number.isSafeInteger(expected) || expected < 0) {
    return null;
  }

  const output = new Uint8Array(expected);
  let written = 0;
  let cursor = 0;

  while (cursor < bytes.length) {
    const control = bytes[cursor] as number;
    cursor += 1;

    for (let bit = 0; bit < 8; bit += 1) {
      if (cursor >= bytes.length) {
        // A control byte may describe fewer than eight items when the input
        // ended; anything left in it is padding, not a truncated stream.
        break;
      }

      if ((control & (1 << bit)) === 0) {
        if (written >= expected) {
          return null;
        }
        output[written] = bytes[cursor] as number;
        written += 1;
        cursor += 1;
        continue;
      }

      if (cursor + 1 >= bytes.length) {
        return null;
      }
      const low = bytes[cursor] as number;
      const high = bytes[cursor + 1] as number;
      cursor += 2;

      const offset = (((high >> 4) << 8) | low) + 1;
      const length = (high & 0x0f) + LZSS_MIN_MATCH;

      // A reference pointing before the start of the output is the signature of
      // a token that was edited by hand.
      if (offset > written || written + length > expected) {
        return null;
      }

      for (let step = 0; step < length; step += 1) {
        // Copied one byte at a time on purpose: an overlapping reference is how
        // a run is encoded, and it has to read what this loop just wrote.
        output[written] = output[written - offset] as number;
        written += 1;
      }
    }
  }

  return written === expected ? output : null;
}
