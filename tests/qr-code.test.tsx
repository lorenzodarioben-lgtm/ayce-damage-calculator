import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode } from '@/components/share/QrCode';
import { MAX_QR_TEXT_LENGTH, buildQrMatrix } from '@/lib/qr';

/*
 * The drawing carries no text of its own, so the label is the only thing that
 * says what scanning it would do. The other half worth holding is the empty
 * case: a link too long to encode has to leave nothing behind rather than an
 * unscannable square, because the copyable link beside it is already the answer.
 *
 * The real encoder is used throughout; the matrix itself is tested in its own
 * suite, and re-deriving it here would only test the encoder twice.
 */

const LINK = 'https://ayce.example/share/abcdef123456';

describe('QrCode', () => {
  it('draws an image with the label as its accessible name', () => {
    render(<QrCode value={LINK} label="Scan to open this meal" />);

    expect(screen.getByRole('img', { name: 'Scan to open this meal' })).toBeInTheDocument();
  });

  it('draws the code as one path', () => {
    const { container } = render(<QrCode value={LINK} label="Scan to open this meal" />);

    const path = container.querySelector('svg path');
    expect(path).not.toBeNull();
    expect(path).toHaveAttribute('d', expect.stringContaining('M'));
  });

  it('insets the drawing by the quiet zone every reader needs', () => {
    const { container } = render(<QrCode value={LINK} label="Scan to open this meal" />);

    expect(container.querySelector('svg path')).toHaveAttribute('transform', 'translate(4 4)');
  });

  it('sizes its viewBox to the matrix plus a quiet zone on both sides', () => {
    const matrix = buildQrMatrix(LINK)!;
    const { container } = render(<QrCode value={LINK} label="Scan to open this meal" />);

    const extent = matrix.size + 8;
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', `0 0 ${extent} ${extent}`);
  });

  it('renders nothing at all for a link too long to encode', () => {
    const tooLong = `${LINK}/${'x'.repeat(MAX_QR_TEXT_LENGTH)}`;
    // Confirms the value really is past the boundary rather than merely large.
    expect(buildQrMatrix(tooLong)).toBeNull();

    const { container } = render(<QrCode value={tooLong} label="Scan to open this meal" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
