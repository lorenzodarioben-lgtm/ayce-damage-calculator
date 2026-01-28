import qrcode from 'qrcode-generator';

/**
 * QR encoding for the stateless links this app already produces.
 *
 * The one place the project reaches for a dependency. Everything else here is
 * either browser-native or short enough to write; a standards-correct QR
 * encoder is neither — it needs Reed-Solomon error correction, eight mask
 * patterns and forty version tables, and getting any of it subtly wrong
 * produces a code that scans as something else. `qrcode-generator` is a single
 * dependency-free MIT module that does exactly this and nothing else.
 *
 * The rendering is still ours: the module is used only to work out which
 * modules are dark, and the SVG below is built from that so it inherits the
 * app's own colours rather than importing a second visual language.
 */

/** Beyond this a code stops being scannable from a phone across a table. */
export const MAX_QR_TEXT_LENGTH = 1200;

export interface QrMatrix {
  /** Modules per side, including no quiet zone. */
  readonly size: number;
  /** Row-major, true where the module is dark. */
  readonly modules: readonly boolean[];
}

/**
 * Builds the module matrix, or returns null when the text is too long to make
 * a code anyone could actually scan.
 */
export function buildQrMatrix(text: string): QrMatrix | null {
  if (text.length === 0 || text.length > MAX_QR_TEXT_LENGTH) {
    return null;
  }

  try {
    // Type 0 lets the encoder pick the smallest version that fits; medium
    // correction survives a fingerprint on a phone screen.
    const code = qrcode(0, 'M');
    code.addData(text);
    code.make();

    const size = code.getModuleCount();
    const modules: boolean[] = [];
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        modules.push(code.isDark(row, column));
      }
    }
    return { size, modules };
  } catch {
    // The encoder throws when the data cannot fit any version; a link that
    // cannot be a QR code is not an error, it just gets copied instead.
    return null;
  }
}

/** The dark modules as `x y` pairs, for drawing without a rect per module. */
export function qrPath(matrix: QrMatrix): string {
  const commands: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.modules[row * matrix.size + column]) {
        commands.push(`M${column},${row}h1v1h-1z`);
      }
    }
  }
  return commands.join('');
}
