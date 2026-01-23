import { useId } from 'react';
import type { FoodItem, VisualVariant } from '@/types/meal';

/**
 * Every cut is drawn from one tone ramp. Keeping flesh, fat and glaze together
 * is what lets a handful of shape primitives read as eighteen different foods.
 */
interface Tone {
  /** Lit face of the meat. */
  readonly light: string;
  readonly base: string;
  /** Shaded underside, also used for the contact shadow. */
  readonly deep: string;
  /** Marbling, fat caps and rendered edges. */
  readonly fat: string;
  /** Glaze, sear or garnish. */
  readonly accent: string;
}

const TONES = {
  beef: {
    light: '#C75544',
    base: '#A03A2C',
    deep: '#68201A',
    fat: '#F3E3CB',
    accent: '#E08A5F',
  },
  beefRich: {
    light: '#C55A46',
    base: '#9C3C2B',
    deep: '#62211A',
    fat: '#F7E8D2',
    accent: '#E5A06B',
  },
  beefMarinated: {
    light: '#A85A38',
    base: '#7C3D24',
    deep: '#4A2214',
    fat: '#E7CFAA',
    accent: '#D99A4E',
  },
  beefFatty: {
    light: '#CB6D57',
    base: '#A44B38',
    deep: '#6B291E',
    fat: '#F9EDDA',
    accent: '#E5A075',
  },
  beefPale: {
    light: '#D1907E',
    base: '#AE6A58',
    deep: '#763F34',
    fat: '#F5E6D6',
    accent: '#DDB396',
  },
  wagyu: {
    light: '#D67464',
    base: '#B04C3E',
    deep: '#72271E',
    fat: '#FCF3E4',
    accent: '#E9C07A',
  },
  porkPale: {
    light: '#E2A794',
    base: '#C47C6B',
    deep: '#8A4A3F',
    fat: '#FBF1E4',
    accent: '#EFC2AC',
  },
  porkRich: {
    light: '#DD9A87',
    base: '#BE7161',
    deep: '#834338',
    fat: '#FAEDE0',
    accent: '#E9B49C',
  },
  porkPlain: {
    light: '#CE8F7C',
    base: '#AC6553',
    deep: '#743A2F',
    fat: '#EFDECC',
    accent: '#D9A288',
  },
  spicyPork: {
    light: '#D2603A',
    base: '#AE3F22',
    deep: '#6E2413',
    fat: '#F0D6B4',
    accent: '#F0A03F',
  },
  spicyChicken: {
    light: '#DE7B3E',
    base: '#BC5626',
    deep: '#7A3315',
    fat: '#F6E2BE',
    accent: '#F5B64C',
  },
  chickenGolden: {
    light: '#E7BC77',
    base: '#C99553',
    deep: '#8A6230',
    fat: '#F9EDD6',
    accent: '#F2D294',
  },
  chickenPale: {
    light: '#EFD7A8',
    base: '#D6B47C',
    deep: '#98784A',
    fat: '#FBF3E2',
    accent: '#E9D3A0',
  },
  prawn: {
    light: '#F5AE8B',
    base: '#E07E56',
    deep: '#A24C2C',
    fat: '#FDEDE0',
    accent: '#F7CDB2',
  },
  squid: {
    light: '#F6E9DE',
    base: '#DCC7B6',
    deep: '#9C8375',
    fat: '#FFFAF3',
    accent: '#E4C9A6',
  },
  salmon: {
    light: '#F8AC77',
    base: '#E8834A',
    deep: '#AE5225',
    fat: '#FCEEE0',
    accent: '#FFDCBE',
  },
  scallop: {
    light: '#F9EFDF',
    base: '#E7D2B6',
    deep: '#AC9276',
    fat: '#FFFCF6',
    accent: '#D9A860',
  },
} as const satisfies Record<string, Tone>;

type ToneId = keyof typeof TONES;

/** One tone per variant, so the switch below stays total and fallback-free. */
const VARIANT_TONE: Record<VisualVariant, ToneId> = {
  'brisket-slices': 'beef',
  'short-rib-blocks': 'beefRich',
  'ribeye-steak': 'beef',
  'bulgogi-tangle': 'beefMarinated',
  'beef-belly-strips': 'beefFatty',
  'tongue-ovals': 'beefPale',
  'wagyu-blocks': 'wagyu',
  'pork-belly-layers': 'porkPale',
  'spicy-pork': 'spicyPork',
  'jowl-rounds': 'porkRich',
  'shoulder-cuts': 'porkPlain',
  'chicken-thigh-pieces': 'chickenGolden',
  'spicy-chicken': 'spicyChicken',
  'chicken-fillets': 'chickenPale',
  prawns: 'prawn',
  'squid-rings': 'squid',
  'salmon-fillet': 'salmon',
  scallops: 'scallop',
};

interface Paint {
  readonly tone: Tone;
  /** url(#…) references, scoped to this instance. */
  readonly flesh: string;
  readonly gloss: string;
}

/** Contact shadow drawn as an offset copy — cheaper and crisper than a blur filter. */
const SHADOW = { fill: '#000000', opacity: 0.42, dx: 0.5, dy: 3 } as const;

interface SlabProps extends Paint {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  /** Cream cap along the top edge, the strongest "this is meat" cue at card size. */
  fatCap?: number;
  marbling?: readonly string[];
}

function Slab({ x, y, w, h, rot = 0, fatCap = 0, marbling, tone, flesh, gloss }: SlabProps) {
  const r = h / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect
        x={SHADOW.dx}
        y={SHADOW.dy}
        width={w}
        height={h}
        rx={r}
        fill={SHADOW.fill}
        opacity={SHADOW.opacity}
      />
      <rect width={w} height={h} rx={r} fill={flesh} />
      {fatCap > 0 && (
        <path
          d={`M${r * 0.6} ${fatCap / 2 + 1} h${w - r * 1.2}`}
          stroke={tone.fat}
          strokeWidth={fatCap}
          strokeLinecap="round"
          opacity="0.95"
        />
      )}
      {marbling?.map((d, index) => (
        <path
          key={index}
          d={d}
          stroke={tone.fat}
          strokeWidth="2.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      ))}
      <rect width={w} height={h * 0.5} rx={r * 0.8} fill={gloss} />
      <rect
        width={w}
        height={h}
        rx={r}
        fill="none"
        stroke={tone.deep}
        strokeWidth="1.2"
        opacity="0.55"
      />
    </g>
  );
}

interface DiscProps extends Paint {
  cx: number;
  cy: number;
  r: number;
  style: 'tongue' | 'jowl' | 'scallop';
}

function Disc({ cx, cy, r, style, tone, flesh, gloss }: DiscProps) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <ellipse
        cx={SHADOW.dx}
        cy={SHADOW.dy}
        rx={r}
        ry={r * 0.9}
        fill={SHADOW.fill}
        opacity={SHADOW.opacity}
      />
      <ellipse rx={r} ry={r * 0.9} fill={flesh} />

      {style === 'tongue' && (
        <>
          {/* A cross-section: pale outer skin ring around a denser core. */}
          <ellipse
            rx={r * 0.86}
            ry={r * 0.76}
            fill="none"
            stroke={tone.fat}
            strokeWidth={r * 0.2}
            opacity="0.75"
          />
          <ellipse rx={r * 0.66} ry={r * 0.58} fill={tone.deep} opacity="0.45" />
          <ellipse rx={r * 0.66} ry={r * 0.58} fill={tone.light} opacity="0.4" />
        </>
      )}

      {style === 'jowl' && (
        /* Jowl is nearly all fat: broad seams sweeping across the whole face. */
        <g stroke={tone.fat} fill="none" strokeLinecap="round">
          <path
            d={`M${-r * 0.82} ${-r * 0.1} q${r * 0.8} ${-r * 0.6} ${r * 1.62} ${r * 0.05}`}
            strokeWidth={r * 0.26}
          />
          <path
            d={`M${-r * 0.72} ${r * 0.42} q${r * 0.72} ${-r * 0.5} ${r * 1.44} ${-r * 0.02}`}
            strokeWidth={r * 0.2}
            opacity="0.9"
          />
          <path
            d={`M${-r * 0.42} ${r * 0.7} q${r * 0.42} ${-r * 0.28} ${r * 0.86} ${-r * 0.04}`}
            strokeWidth={r * 0.14}
            opacity="0.75"
          />
        </g>
      )}

      {style === 'scallop' && (
        <>
          {/* A seared cap over short vertical fibres — the muscle grain of a
              scallop, without the snowflake a full radial burst produces. */}
          <ellipse cy={-r * 0.08} rx={r * 0.78} ry={r * 0.64} fill={tone.accent} opacity="0.4" />
          {[-0.42, -0.14, 0.14, 0.42].map((k, i) => (
            <line
              key={i}
              x1={r * k}
              y1={-r * 0.3}
              x2={r * k}
              y2={r * 0.42}
              stroke={tone.deep}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.22"
            />
          ))}
        </>
      )}

      <ellipse cy={-r * 0.22} rx={r * 0.8} ry={r * 0.42} fill={gloss} />
      <ellipse rx={r} ry={r * 0.9} fill="none" stroke={tone.deep} strokeWidth="1.2" opacity="0.5" />
    </g>
  );
}

/** Sesame and chilli flecks scattered over glazed cuts. */
function Garnish({ tone, seed }: { tone: Tone; seed: readonly (readonly [number, number])[] }) {
  return (
    <g>
      {seed.map(([x, y], index) => (
        <circle
          key={index}
          cx={x}
          cy={y}
          r={index % 3 === 0 ? 2.2 : 1.6}
          fill={index % 3 === 0 ? tone.accent : tone.fat}
          opacity="0.9"
        />
      ))}
    </g>
  );
}

function BriskeSlices(paint: Paint) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <Slab
          key={i}
          {...paint}
          x={16 + i * 13}
          y={30 + i * 12}
          w={62}
          h={17}
          rot={-12}
          fatCap={4}
          marbling={['M14 11 q10 -4 20 -1', 'M38 12 q8 -3 14 -1']}
        />
      ))}
    </g>
  );
}

function Blocks({ premium, plain, ...paint }: Paint & { premium?: boolean; plain?: boolean }) {
  // Plain cuts still get a seam or two; a bare slab reads as unfinished art.
  const marbling = plain
    ? ['M12 16 q12 -4 22 1']
    : premium
      ? ['M8 8 q10 -3 18 1', 'M10 15 q12 -4 22 1', 'M9 22 q14 -4 24 0', 'M22 5 q8 4 10 10']
      : ['M9 10 q12 -4 22 1', 'M11 20 q12 -4 22 1'];

  const layout = plain
    ? ([
        [20, 26, -7],
        [52, 46, 5],
        [18, 62, 3],
        [48, 82, -5],
      ] as const)
    : ([
        [22, 30, -8],
        [50, 52, 6],
        [26, 74, -4],
      ] as const);

  return (
    <g>
      {layout.map(([x, y, rot], i) => (
        <Slab
          key={i}
          {...paint}
          x={x}
          y={y}
          w={plain ? 50 : 54}
          h={plain ? 25 : 28}
          rot={rot}
          fatCap={premium ? 5 : plain ? 2.5 : 4}
          marbling={marbling}
        />
      ))}
      {premium && (
        <Garnish
          tone={paint.tone}
          seed={[
            [46, 26],
            [86, 52],
            [40, 96],
          ]}
        />
      )}
    </g>
  );
}

function RibeyeSteak({ tone, flesh, gloss }: Paint) {
  const body =
    'M6 34 q-4 -22 20 -26 q30 -5 48 6 q20 9 18 28 q-2 22 -26 26 q-32 6 -50 -8 q-12 -9 -10 -26 Z';
  return (
    <g transform="translate(20 24)">
      <path d={body} transform="translate(0.5 3)" fill={SHADOW.fill} opacity={SHADOW.opacity} />
      <path d={body} fill={flesh} />
      {/* Marbling runs with the grain in short tapered seams. A branching web
          reads as a scribble laid on top rather than as fat inside the muscle. */}
      <g stroke={tone.fat} fill="none" strokeLinecap="round">
        <path d="M20 24 q13 -5 25 -2" strokeWidth="2.2" opacity="0.7" />
        <path d="M50 25 q10 -2 17 2" strokeWidth="1.8" opacity="0.55" />
        <path d="M16 36 q16 -5 30 -1" strokeWidth="2.4" opacity="0.72" />
        <path d="M52 37 q12 -1 18 4" strokeWidth="1.9" opacity="0.55" />
        <path d="M19 47 q15 -5 29 0" strokeWidth="2.2" opacity="0.68" />
        <path d="M54 50 q10 0 14 5" strokeWidth="1.7" opacity="0.5" />
        <path d="M24 58 q14 -4 26 1" strokeWidth="2" opacity="0.6" />
        <path d="M32 30 q3 9 1 17" strokeWidth="1.5" opacity="0.4" />
        <path d="M60 32 q3 10 0 18" strokeWidth="1.5" opacity="0.4" />
      </g>
      {/* Fat cap: a filled crescent hugging the outer curve, not a stroke. */}
      <path
        d="M6 34 q-4 -22 20 -26 q30 -5 48 6 q-3 5 -11 3 q-23 -6 -40 -1 q-8 3 -6 15 Z"
        fill={tone.fat}
        opacity="0.85"
      />
      <path d={body} fill={gloss} />
      <path d={body} fill="none" stroke={tone.deep} strokeWidth="1.4" opacity="0.5" />
    </g>
  );
}

function BulgogiTangle(paint: Paint) {
  return (
    <g>
      {[
        [16, 28, -18],
        [38, 48, 12],
        [18, 68, 4],
        [40, 88, -12],
      ].map(([x, y, rot], i) => (
        <Slab
          key={i}
          {...paint}
          x={x ?? 0}
          y={y ?? 0}
          w={62}
          h={19}
          rot={rot ?? 0}
          fatCap={2.5}
          marbling={['M16 12 q14 -4 26 0', 'M20 6 q10 -2 18 1']}
        />
      ))}
      <Garnish
        tone={paint.tone}
        seed={[
          [38, 40],
          [72, 52],
          [50, 78],
          [86, 82],
        ]}
      />
    </g>
  );
}

/** Belly cuts: alternating meat and rendered-fat bands within each strip. */
function BellyStrips({ bands, ...paint }: Paint & { bands: number }) {
  return (
    <g>
      {[
        [18, 28, -7],
        [22, 54, 4],
        [16, 80, -3],
      ].map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x ?? 0} ${y ?? 0}) rotate(${rot ?? 0})`}>
          <rect
            x={SHADOW.dx}
            y={SHADOW.dy}
            width={86}
            height={22}
            rx={7}
            fill={SHADOW.fill}
            opacity={SHADOW.opacity}
          />
          <rect width={86} height={22} rx={7} fill={paint.flesh} />
          {Array.from({ length: bands }, (_, band) => (
            <rect
              key={band}
              x={3}
              y={4 + band * (14 / bands)}
              width={80}
              height={3.4}
              rx={1.7}
              fill={paint.tone.fat}
              opacity={0.92 - band * 0.12}
            />
          ))}
          <rect width={86} height={11} rx={6} fill={paint.gloss} />
          <rect
            width={86}
            height={22}
            rx={7}
            fill="none"
            stroke={paint.tone.deep}
            strokeWidth="1.2"
            opacity="0.5"
          />
        </g>
      ))}
    </g>
  );
}

/** Rounded grill-cut chunks; the glaze flag turns them into marinated pieces. */
function Chunks({ glazed, ...paint }: Paint & { glazed?: boolean }) {
  const pieces = [
    [26, 30, 34, 26, -10],
    [66, 38, 30, 24, 12],
    [30, 62, 32, 25, 6],
    [68, 70, 28, 23, -8],
    [44, 90, 30, 22, 3],
  ] as const;

  return (
    <g>
      {pieces.map(([x, y, w, h, rot], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <rect
            x={SHADOW.dx}
            y={SHADOW.dy}
            width={w}
            height={h}
            rx={h * 0.42}
            fill={SHADOW.fill}
            opacity={SHADOW.opacity}
          />
          <rect width={w} height={h} rx={h * 0.42} fill={paint.flesh} />
          {glazed && (
            <rect width={w} height={h} rx={h * 0.42} fill={paint.tone.accent} opacity="0.28" />
          )}
          <path
            d={`M${w * 0.2} ${h * 0.62} q${w * 0.3} ${-h * 0.3} ${w * 0.6} ${-h * 0.08}`}
            stroke={paint.tone.fat}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          <rect width={w} height={h * 0.45} rx={h * 0.35} fill={paint.gloss} />
          <rect
            width={w}
            height={h}
            rx={h * 0.42}
            fill="none"
            stroke={paint.tone.deep}
            strokeWidth="1.2"
            opacity="0.5"
          />
        </g>
      ))}
      {glazed && (
        <Garnish
          tone={paint.tone}
          seed={[
            [40, 26],
            [78, 44],
            [34, 84],
            [88, 78],
            [58, 58],
          ]}
        />
      )}
    </g>
  );
}

/** Salmon portions: a tapered fillet shape banded with pale connective flakes. */
function SalmonFillets(paint: Paint) {
  const body = 'M0 18 q10 -18 38 -18 q34 0 46 18 q-12 18 -46 18 q-28 0 -38 -18 Z';
  return (
    <g>
      {[
        [16, 26, -8],
        [26, 56, 5],
        [18, 84, -4],
      ].map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x ?? 0} ${y ?? 0}) rotate(${rot ?? 0})`}>
          <path
            d={body}
            transform={`translate(${SHADOW.dx} ${SHADOW.dy})`}
            fill={SHADOW.fill}
            opacity={SHADOW.opacity}
          />
          <path d={body} fill={paint.flesh} />
          <g stroke={paint.tone.fat} fill="none" strokeLinecap="round">
            <path d="M10 12 q26 -6 62 0" strokeWidth="3.4" />
            <path d="M8 20 q28 -6 66 0" strokeWidth="3" opacity="0.9" />
            <path d="M12 28 q24 -5 56 0" strokeWidth="2.6" opacity="0.8" />
          </g>
          <path d={body} fill={paint.gloss} />
          <path d={body} fill="none" stroke={paint.tone.deep} strokeWidth="1.3" opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

/**
 * Garlic chicken: broad scored fillets. Deliberately a different silhouette
 * from the salmon portion, which the pale tone alone would not achieve.
 */
function GarlicFillets(paint: Paint) {
  return (
    <g>
      {[
        [14, 28, -6],
        [20, 56, 5],
        [15, 84, -3],
      ].map(([x, y, rot], i) => (
        <Slab
          key={i}
          {...paint}
          x={x ?? 0}
          y={y ?? 0}
          w={88}
          h={24}
          rot={rot ?? 0}
          marbling={['M22 6 q6 6 -2 12', 'M42 5 q6 6 -2 13', 'M62 6 q6 6 -2 12']}
        />
      ))}
      <Garnish
        tone={paint.tone}
        seed={[
          [34, 30],
          [76, 44],
          [40, 74],
          [84, 88],
        ]}
      />
    </g>
  );
}

function Prawns({ tone, flesh, gloss }: Paint) {
  const hook = 'M0 14 q0 -14 15 -14 q16 0 16 15 q0 12 -11 12 q-9 0 -9 -8';
  return (
    <g>
      {[
        [26, 28, -18],
        [64, 24, 22],
        [34, 62, 6],
        [72, 62, -12],
        [46, 92, 14],
      ].map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x ?? 0} ${y ?? 0}) rotate(${rot ?? 0})`}>
          <path
            d={hook}
            transform={`translate(${SHADOW.dx} ${SHADOW.dy})`}
            fill="none"
            stroke={SHADOW.fill}
            strokeWidth="13"
            strokeLinecap="round"
            opacity={SHADOW.opacity}
          />
          <path d={hook} fill="none" stroke={flesh} strokeWidth="13" strokeLinecap="round" />
          {/* Segment banding and a tail fan keep prawns from reading as plain hooks. */}
          <path
            d={hook}
            fill="none"
            stroke={tone.deep}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray="1.6 7"
            opacity="0.32"
          />
          <path
            d={hook}
            fill="none"
            stroke={gloss}
            strokeWidth="5"
            strokeLinecap="round"
            transform="translate(-2 -2)"
          />
          <g stroke={tone.light} strokeWidth="3" strokeLinecap="round" opacity="0.95">
            <path d="M1 16 l-9 4" />
            <path d="M1 16 l-9 -2" />
            <path d="M1 16 l-6 8" />
          </g>
        </g>
      ))}
    </g>
  );
}

function SquidRings({ tone, flesh, gloss }: Paint) {
  return (
    <g>
      {[
        [34, 34, 15],
        [72, 32, 12],
        [50, 66, 16],
        [86, 66, 11],
        [36, 84, 12],
      ].map(([cx, cy, r], i) => (
        <g key={i} transform={`translate(${cx ?? 0} ${cy ?? 0})`}>
          <circle
            cx={SHADOW.dx}
            cy={SHADOW.dy}
            r={r ?? 12}
            fill="none"
            stroke={SHADOW.fill}
            strokeWidth={(r ?? 12) * 0.56}
            opacity={SHADOW.opacity}
          />
          <circle r={r ?? 12} fill="none" stroke={flesh} strokeWidth={(r ?? 12) * 0.56} />
          <circle
            r={r ?? 12}
            fill="none"
            stroke={tone.deep}
            strokeWidth={(r ?? 12) * 0.56}
            strokeDasharray="2 6"
            opacity="0.22"
          />
          <circle
            r={r ?? 12}
            cy={-1.5}
            fill="none"
            stroke={gloss}
            strokeWidth={(r ?? 12) * 0.2}
            strokeDasharray={`${(r ?? 12) * 1.6} ${(r ?? 12) * 4}`}
          />
        </g>
      ))}
    </g>
  );
}

function Scallops(paint: Paint) {
  return (
    <g>
      {[
        [38, 38, 17],
        [76, 44, 15],
        [50, 78, 16],
        [88, 82, 12],
      ].map(([cx, cy, r], i) => (
        <Disc key={i} {...paint} cx={cx ?? 0} cy={cy ?? 0} r={r ?? 14} style="scallop" />
      ))}
    </g>
  );
}

function Discs({ style, ...paint }: Paint & { style: 'tongue' | 'jowl' }) {
  const layout =
    style === 'tongue'
      ? ([
          [36, 36, 18],
          [74, 40, 17],
          [50, 74, 18],
          [86, 78, 15],
        ] as const)
      : ([
          [38, 40, 21],
          [78, 48, 19],
          [48, 82, 20],
        ] as const);

  return (
    <g>
      {layout.map(([cx, cy, r], i) => (
        <Disc key={i} {...paint} cx={cx} cy={cy} r={r} style={style} />
      ))}
    </g>
  );
}

function renderVariant(variant: VisualVariant, paint: Paint) {
  switch (variant) {
    case 'brisket-slices':
      return <BriskeSlices {...paint} />;
    case 'short-rib-blocks':
      return <Blocks {...paint} />;
    case 'wagyu-blocks':
      return <Blocks {...paint} premium />;
    case 'shoulder-cuts':
      return <Blocks {...paint} plain />;
    case 'ribeye-steak':
      return <RibeyeSteak {...paint} />;
    case 'bulgogi-tangle':
      return <BulgogiTangle {...paint} />;
    case 'beef-belly-strips':
      return <BellyStrips {...paint} bands={2} />;
    case 'pork-belly-layers':
      return <BellyStrips {...paint} bands={3} />;
    case 'tongue-ovals':
      return <Discs {...paint} style="tongue" />;
    case 'jowl-rounds':
      return <Discs {...paint} style="jowl" />;
    case 'chicken-thigh-pieces':
      return <Chunks {...paint} />;
    case 'spicy-pork':
    case 'spicy-chicken':
      return <Chunks {...paint} glazed />;
    case 'chicken-fillets':
      return <GarlicFillets {...paint} />;
    case 'salmon-fillet':
      return <SalmonFillets {...paint} />;
    case 'prawns':
      return <Prawns {...paint} />;
    case 'squid-rings':
      return <SquidRings {...paint} />;
    case 'scallops':
      return <Scallops {...paint} />;
  }
}

/**
 * A deliberately neutral plate for diner-authored menu items.
 *
 * It keeps the ceramic, light and food scale of the illustrated menu without
 * pretending a handwritten description tells us exactly how the dish looks.
 */
function CustomFoodArtwork({ flesh, gloss, tone }: Paint) {
  return (
    <g data-custom-food-artwork="true">
      <ellipse cx="64" cy="72" rx="31" ry="12" fill="#050403" opacity="0.45" />
      <path
        d="M34 70c5-23 18-34 30-34s25 11 30 34c-6 13-15 20-30 20S40 83 34 70Z"
        fill={flesh}
        stroke={tone.accent}
        strokeWidth="2"
      />
      <path
        d="M42 62c11-10 33-10 44 0M40 72c13 9 35 9 48 0"
        fill="none"
        stroke={gloss}
        strokeWidth="4"
      />
      <circle cx="64" cy="64" r="9" fill={tone.accent} opacity="0.85" />
      <path d="M64 57v14M57 64h14" stroke="#F3E8D0" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}

interface FoodIllustrationProps {
  food: FoodItem & { readonly isCustom?: boolean };
  className?: string;
}

/**
 * A stylised overhead plate. The ceramic, lighting and contact shadows are
 * shared; the arrangement and tone ramp carry the difference between cuts.
 */
export function FoodIllustration({ food, className }: FoodIllustrationProps) {
  const uid = useId().replace(/:/g, '');
  const plateId = `plate-${uid}`;
  const fleshId = `flesh-${uid}`;
  const glossId = `gloss-${uid}`;
  const clipId = `clip-${uid}`;

  const tone = food.isCustom ? TONES.beefMarinated : TONES[VARIANT_TONE[food.visualVariant]];
  const paint: Paint = { tone, flesh: `url(#${fleshId})`, gloss: `url(#${glossId})` };

  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={plateId} cx="34%" cy="24%" r="86%">
          <stop offset="0%" stopColor="#453A30" />
          <stop offset="48%" stopColor="#261F19" />
          <stop offset="100%" stopColor="#100D0B" />
        </radialGradient>
        <linearGradient id={fleshId} x1="0.15" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={tone.light} />
          <stop offset="52%" stopColor={tone.base} />
          <stop offset="100%" stopColor={tone.deep} />
        </linearGradient>
        <linearGradient id={glossId} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx="64" cy="64" r="50" />
        </clipPath>
      </defs>

      {/* Plate: drop shadow, ceramic body, rim and inner well. */}
      <ellipse cx="66" cy="73" rx="55" ry="53" fill="#080706" opacity="0.75" />
      <circle cx="64" cy="64" r="58" fill={`url(#${plateId})`} />
      <circle
        cx="64"
        cy="64"
        r="58"
        fill="none"
        stroke="#584839"
        strokeWidth="1.6"
        opacity="0.85"
      />
      <circle
        cx="64"
        cy="64"
        r="50"
        fill="none"
        stroke="#6B573F"
        strokeWidth="1.1"
        opacity="0.45"
      />
      <circle cx="64" cy="64" r="50" fill="#0F0C0A" opacity="0.35" />

      <g clipPath={`url(#${clipId})`}>
        {food.isCustom ? (
          <CustomFoodArtwork {...paint} />
        ) : (
          renderVariant(food.visualVariant, paint)
        )}
      </g>

      {/* Specular arc: the pendant-lamp highlight the rest of the page uses. */}
      <path
        d="M24 40 a54 54 0 0 1 40 -32"
        fill="none"
        stroke="#F3E8D0"
        strokeWidth="2.6"
        opacity="0.22"
        strokeLinecap="round"
      />
    </svg>
  );
}
