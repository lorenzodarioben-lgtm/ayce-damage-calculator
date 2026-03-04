import {
  CARD_COLOURS,
  CARD_FOOTER,
  type CardStat,
  type ResultCardModel,
  type StatTone,
} from '@/lib/resultCard';

const WIDTH = 420;
const PADDING = 24;
const GAP = 18;
const PANEL_PADDING = 16;
const COLUMN_GAP = 16;

/**
 * A style names the role it wants, not a font stack.
 *
 * The families are generated: `next/font` hashes each one, so naming "Anton"
 * here would have quietly measured and drawn the fallback while the page beside
 * it used the real face. Reading the same custom properties the stylesheet
 * reads is what keeps the exported card on the typeface the on-screen card is
 * rendered in — which is the point of both being drawn from one model.
 */
type FontRole = 'display' | 'sans';

/** Used verbatim on a server, and appended after the resolved family in a browser. */
const FALLBACK_FAMILIES: Record<FontRole, string> = {
  display: "'Arial Narrow', Impact, ui-sans-serif, sans-serif",
  sans: "ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif",
};

const FAMILY_VARIABLES: Record<FontRole, string> = {
  display: '--font-display',
  sans: '--font-sans',
};

/*
 * Resolved once. The custom property holds a family name, which is a constant
 * of the build rather than of load state, so there is nothing to invalidate.
 */
let cachedFamilies: Record<FontRole, string> | null = null;

function familyFor(role: FontRole): string {
  if (cachedFamilies) {
    return cachedFamilies[role];
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_FAMILIES[role];
  }

  const computed = getComputedStyle(document.documentElement);
  const resolve = (which: FontRole) => {
    const declared = computed.getPropertyValue(FAMILY_VARIABLES[which]).trim();
    return declared ? `${declared}, ${FALLBACK_FAMILIES[which]}` : FALLBACK_FAMILIES[which];
  };

  cachedFamilies = { display: resolve('display'), sans: resolve('sans') };
  return cachedFamilies[role];
}

const SANS: FontRole = 'sans';
const DISPLAY: FontRole = 'display';

const TONE_COLOURS: Record<StatTone, string> = {
  cream: CARD_COLOURS.cream,
  ember: CARD_COLOURS.ember,
  green: CARD_COLOURS.green,
  red: CARD_COLOURS.red,
};

type Ctx = CanvasRenderingContext2D;

interface TextStyle {
  readonly font: FontRole;
  readonly size: number;
  readonly lineHeight: number;
  readonly colour: string;
  readonly tracking: number;
  readonly uppercase: boolean;
}

const STYLES = {
  eyebrow: {
    font: SANS,
    size: 11,
    lineHeight: 14,
    colour: CARD_COLOURS.ember,
    tracking: 3,
    uppercase: true,
  },
  restaurant: {
    font: SANS,
    size: 13,
    lineHeight: 18,
    colour: CARD_COLOURS.muted,
    tracking: 0,
    uppercase: false,
  },
  verdict: {
    font: DISPLAY,
    size: 40,
    lineHeight: 38,
    colour: CARD_COLOURS.cream,
    tracking: 0.5,
    uppercase: true,
  },
  copy: {
    font: SANS,
    size: 13,
    lineHeight: 20,
    colour: CARD_COLOURS.muted,
    tracking: 0,
    uppercase: false,
  },
  statLabel: {
    font: SANS,
    size: 10,
    lineHeight: 13,
    colour: CARD_COLOURS.faint,
    tracking: 1.4,
    uppercase: true,
  },
  statValue: {
    font: DISPLAY,
    size: 26,
    lineHeight: 26,
    colour: CARD_COLOURS.cream,
    tracking: 0.3,
    uppercase: true,
  },
  footer: {
    font: SANS,
    size: 10,
    lineHeight: 14,
    colour: CARD_COLOURS.faint,
    tracking: 1,
    uppercase: true,
  },
} as const satisfies Record<string, TextStyle>;

function applyStyle(ctx: Ctx, style: TextStyle, weight = '600') {
  const isDisplay = style.font === DISPLAY;
  ctx.font = `${isDisplay ? '400' : weight} ${style.size}px ${familyFor(style.font)}`;
  ctx.fillStyle = style.colour;
  // letterSpacing is widely supported but still guarded so export never throws.
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${style.tracking}px`;
  }
}

function wrapText(ctx: Ctx, text: string, style: TextStyle, maxWidth: number): string[] {
  applyStyle(ctx, style);
  const source = style.uppercase ? text.toUpperCase() : text;
  const words = source.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function drawLines(ctx: Ctx, lines: string[], style: TextStyle, x: number, top: number): number {
  applyStyle(ctx, style);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  lines.forEach((line, index) => {
    // Sits the cap height roughly on the line box rather than the baseline.
    ctx.fillText(line, x, top + style.size * 0.82 + index * style.lineHeight);
  });
  return lines.length * style.lineHeight;
}

function drawStat(ctx: Ctx, stat: CardStat, x: number, top: number, maxWidth: number): number {
  const labelLines = wrapText(ctx, stat.label, STYLES.statLabel, maxWidth);
  let y = top + drawLines(ctx, labelLines, STYLES.statLabel, x, top);

  const valueStyle: TextStyle = { ...STYLES.statValue, colour: TONE_COLOURS[stat.tone] };
  y += 5;
  const valueLines = wrapText(ctx, stat.value, valueStyle, maxWidth);
  y += drawLines(ctx, valueLines, valueStyle, x, y);

  return y - top;
}

function measureStat(ctx: Ctx, stat: CardStat, maxWidth: number): number {
  const labelHeight = wrapText(ctx, stat.label, STYLES.statLabel, maxWidth).length * 13;
  const valueHeight = wrapText(ctx, stat.value, STYLES.statValue, maxWidth).length * 26;
  return labelHeight + 5 + valueHeight;
}

function drawStatRow(
  ctx: Ctx,
  stats: readonly [CardStat, CardStat],
  left: number,
  top: number,
  contentWidth: number,
): number {
  const columnWidth = (contentWidth - COLUMN_GAP) / 2;
  const heights = stats.map((stat, index) => {
    const columnCentre = left + index * (columnWidth + COLUMN_GAP) + columnWidth / 2;
    return drawStat(ctx, stat, columnCentre, top, columnWidth);
  });
  const [first = 0, second = 0] = heights;
  return Math.max(first, second);
}

function measureStatRow(
  ctx: Ctx,
  stats: readonly [CardStat, CardStat],
  contentWidth: number,
): number {
  const columnWidth = (contentWidth - COLUMN_GAP) / 2;
  return Math.max(...stats.map((stat) => measureStat(ctx, stat, columnWidth)));
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawDivider(ctx: Ctx, left: number, top: number, width: number) {
  ctx.fillStyle = CARD_COLOURS.line;
  ctx.fillRect(left, top, width, 1);
}

interface Layout {
  readonly height: number;
  readonly panelHeight: number;
}

function measure(ctx: Ctx, model: ResultCardModel, contentWidth: number): Layout {
  const panelContentWidth = contentWidth - PANEL_PADDING * 2;
  const panelHeight =
    PANEL_PADDING * 2 +
    measureStatRow(ctx, model.money, panelContentWidth) +
    GAP -
    4 +
    1 +
    GAP -
    4 +
    measureStatRow(ctx, model.outcome, panelContentWidth);

  let height = PADDING;
  height += STYLES.eyebrow.lineHeight;
  if (model.restaurantName) {
    height += 6 + wrapText(ctx, model.restaurantName, STYLES.restaurant, contentWidth).length * 18;
  }
  height += GAP + 1 + GAP;
  height += wrapText(ctx, model.verdictTitle, STYLES.verdict, contentWidth).length * 38;
  height += 10 + wrapText(ctx, model.verdictCopy, STYLES.copy, contentWidth).length * 20;
  height += GAP + 1 + GAP;
  height += measureStatRow(ctx, model.volume, contentWidth);
  height += GAP + panelHeight;
  height += GAP + measureStatRow(ctx, model.nutrition, contentWidth);
  height += GAP + 1 + GAP;
  height += STYLES.footer.lineHeight;
  height += PADDING;

  return { height: Math.ceil(height), panelHeight };
}

function paint(ctx: Ctx, model: ResultCardModel, layout: Layout) {
  const contentWidth = WIDTH - PADDING * 2;
  const left = PADDING;
  const centre = WIDTH / 2;

  ctx.fillStyle = CARD_COLOURS.bg;
  roundedRect(ctx, 0, 0, WIDTH, layout.height, 16);
  ctx.fill();
  ctx.strokeStyle = CARD_COLOURS.line;
  ctx.lineWidth = 1;
  roundedRect(ctx, 0.5, 0.5, WIDTH - 1, layout.height - 1, 16);
  ctx.stroke();

  let y = PADDING;

  y += drawLines(ctx, ['AYCE Damage Report'.toUpperCase()], STYLES.eyebrow, centre, y);

  if (model.restaurantName) {
    y += 6;
    y += drawLines(
      ctx,
      wrapText(ctx, model.restaurantName, STYLES.restaurant, contentWidth),
      STYLES.restaurant,
      centre,
      y,
    );
  }

  y += GAP;
  drawDivider(ctx, left, y, contentWidth);
  y += 1 + GAP;

  y += drawLines(
    ctx,
    wrapText(ctx, model.verdictTitle, STYLES.verdict, contentWidth),
    STYLES.verdict,
    centre,
    y,
  );
  y += 10;
  y += drawLines(
    ctx,
    wrapText(ctx, model.verdictCopy, STYLES.copy, contentWidth),
    STYLES.copy,
    centre,
    y,
  );

  y += GAP;
  drawDivider(ctx, left, y, contentWidth);
  y += 1 + GAP;

  y += drawStatRow(ctx, model.volume, left, y, contentWidth);

  y += GAP;
  ctx.fillStyle = CARD_COLOURS.panel;
  roundedRect(ctx, left, y, contentWidth, layout.panelHeight, 12);
  ctx.fill();
  ctx.strokeStyle = CARD_COLOURS.line;
  roundedRect(ctx, left + 0.5, y + 0.5, contentWidth - 1, layout.panelHeight - 1, 12);
  ctx.stroke();

  const panelLeft = left + PANEL_PADDING;
  const panelContentWidth = contentWidth - PANEL_PADDING * 2;
  let panelY = y + PANEL_PADDING;
  panelY += drawStatRow(ctx, model.money, panelLeft, panelY, panelContentWidth);
  panelY += GAP - 4;
  drawDivider(ctx, panelLeft, panelY, panelContentWidth);
  panelY += 1 + GAP - 4;
  drawStatRow(ctx, model.outcome, panelLeft, panelY, panelContentWidth);

  y += layout.panelHeight + GAP;
  y += drawStatRow(ctx, model.nutrition, left, y, contentWidth);

  y += GAP;
  drawDivider(ctx, left, y, contentWidth);
  y += 1 + GAP;

  drawLines(ctx, [CARD_FOOTER.toUpperCase()], STYLES.footer, centre, y);
}

/**
 * Renders the shareable card straight to a canvas. Drawing it by hand rather
 * than rasterising the DOM keeps the export free of stylesheet and web-font
 * fetching, which is the part of DOM-to-image conversion that fails in practice.
 */
export async function renderResultCardBlob(
  model: ResultCardModel,
  scale = 2,
): Promise<Blob | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  // Canvas silently substitutes fonts that have not finished loading.
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed with fallback fonts rather than failing the export.
    }
  }

  const measuring = document.createElement('canvas').getContext('2d');
  if (!measuring) {
    return null;
  }

  const layout = measure(measuring, model, WIDTH - PADDING * 2);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * scale;
  canvas.height = layout.height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.scale(scale, scale);
  paint(ctx, model, layout);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
