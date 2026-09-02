import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderResultCardBlob } from '@/lib/resultCardImage';
import { CARD_FOOTER, type ResultCardModel } from '@/lib/resultCard';

/*
 * The card is drawn by hand onto a canvas rather than rasterised from the DOM,
 * so nothing here can be checked by querying an element. What is checked
 * instead is the contract the export has to keep: the bitmap is the size the
 * caller asked for, every figure on the model reaches the canvas, and a
 * browser that cannot draw returns null rather than throwing on the way out.
 */

interface Painted {
  readonly texts: string[];
  readonly canvases: { width: number; height: number }[];
}

let painted: Painted;

function fakeContext() {
  let size = 12;
  return {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: '',
    textBaseline: '',
    letterSpacing: '',
    // Width is proportional to the glyph count, which is enough for the
    // wrapping decisions the layout makes to be deterministic.
    measureText(text: string) {
      const match = /(\d+(?:\.\d+)?)px/.exec(this.font as string);
      size = match ? Number(match[1]) : size;
      return { width: text.length * size * 0.6 };
    },
    fillText(text: string) {
      painted.texts.push(text);
    },
    scale: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
  };
}

function model(overrides: Partial<ResultCardModel> = {}): ResultCardModel {
  return {
    restaurantName: 'Seoul Garden',
    verdictTitle: 'You beat the buffet',
    verdictCopy: 'Comfortably ahead.',
    volume: [
      { label: 'Plates', value: '14', tone: 'cream' },
      { label: 'Eaten', value: '2.2 kg', tone: 'cream' },
    ],
    money: [
      { label: 'Retail value', value: '$182.40', tone: 'cream' },
      { label: 'Paid', value: '$59.90', tone: 'cream' },
    ],
    outcome: [
      { label: 'Ahead by', value: '$122.50', tone: 'green' },
      { label: 'Value ratio', value: '3.0x', tone: 'ember' },
    ],
    nutrition: [
      { label: 'Calories', value: '4,820', tone: 'cream' },
      { label: 'Protein', value: '312 g', tone: 'cream' },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  painted = { texts: [], canvases: [] };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => fakeContext() as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    painted.canvases.push({ width: this.width, height: this.height });
    callback(new Blob(['png'], { type: type ?? 'image/png' }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('renderResultCardBlob', () => {
  it('exports the card as a PNG', async () => {
    const blob = await renderResultCardBlob(model());

    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('image/png');
  });

  it('draws at the pixel density it was asked for', async () => {
    await renderResultCardBlob(model(), 3);

    const [canvas] = painted.canvases;
    expect(canvas!.width).toBe(420 * 3);
  });

  it('defaults to a retina bitmap, so the card is not soft when shared', async () => {
    await renderResultCardBlob(model());

    expect(painted.canvases[0]!.width).toBe(420 * 2);
  });

  it('grows the card to fit copy that has to wrap', async () => {
    await renderResultCardBlob(model({ verdictCopy: 'Short.' }));
    await renderResultCardBlob(
      model({
        verdictCopy:
          'You went well past what the entry price bought, and the tab kept climbing after that.',
      }),
    );

    const [short, long] = painted.canvases;
    expect(long!.height).toBeGreaterThan(short!.height);
  });

  it('puts every figure from the model onto the card', async () => {
    await renderResultCardBlob(model());

    const drawn = painted.texts.join(' ');
    expect(drawn).toContain('YOU BEAT THE BUFFET');
    expect(drawn).toContain('Seoul Garden');
    expect(drawn).toContain('$182.40');
    // Stat values are set in the display face, which is drawn uppercased.
    expect(drawn).toContain('3.0X');
    expect(drawn).toContain('312 G');
    expect(drawn).toContain(CARD_FOOTER.toUpperCase());
  });

  it('leaves out the restaurant line when the place was never named', async () => {
    await renderResultCardBlob(model({ restaurantName: '' }));
    const withoutName = painted.canvases[0]!.height;

    painted = { texts: [], canvases: [] };
    await renderResultCardBlob(model());

    expect(painted.canvases[0]!.height).toBeGreaterThan(withoutName);
  });

  it('returns null when the browser will not give it a canvas to draw on', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(await renderResultCardBlob(model())).toBeNull();
  });

  it('returns null when the canvas cannot produce a bitmap', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
      callback(null);
    });

    expect(await renderResultCardBlob(model())).toBeNull();
  });

  it('still exports when the web fonts never finish loading', async () => {
    // Falling back to a system face is a worse-looking card; failing the
    // export would be no card at all.
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.reject(new Error('font load failed')) },
    });

    const blob = await renderResultCardBlob(model());

    expect(blob).not.toBeNull();
  });
});
