import { useId } from 'react';
import type { FoodCategory, FoodItem, VisualVariant } from '@/types/meal';

interface CategoryPalette {
  readonly flesh: string;
  readonly fleshDeep: string;
  readonly marble: string;
  readonly glaze: string;
}

interface Palette extends CategoryPalette {
  /** Instance-scoped url() reference to the shared highlight gradient. */
  readonly sheen: string;
}

/** One warm palette per category so the four groups stay distinguishable. */
const PALETTES: Record<FoodCategory, CategoryPalette> = {
  beef: { flesh: '#9E3B33', fleshDeep: '#6E2620', marble: '#F0DCC6', glaze: '#D8705A' },
  pork: { flesh: '#C97A72', fleshDeep: '#8E4A46', marble: '#FAE9DC', glaze: '#E8A08F' },
  chicken: { flesh: '#D6A45C', fleshDeep: '#9A6D33', marble: '#F7E7C6', glaze: '#EFC384' },
  seafood: { flesh: '#D98A6A', fleshDeep: '#9C5642', marble: '#F6E3D5', glaze: '#F0B49A' },
};

interface ShapeProps {
  readonly palette: Palette;
}

function Slices({ palette }: ShapeProps) {
  return (
    <g>
      {[0, 1, 2, 3].map((index) => (
        <g key={index} transform={`translate(${18 + index * 15} ${34 + index * 4}) rotate(-14)`}>
          <rect width="42" height="15" rx="7" fill={palette.flesh} />
          <rect width="42" height="15" rx="7" fill={palette.sheen} />
          <path d="M6 8 h10 M22 5 h8 M26 11 h9" stroke={palette.marble} strokeWidth="1.6" />
          <rect y="10" width="42" height="5" rx="2.5" fill={palette.fleshDeep} opacity="0.55" />
        </g>
      ))}
    </g>
  );
}

function Ribs({ palette }: ShapeProps) {
  return (
    <g>
      {[0, 1, 2].map((index) => (
        <g key={index} transform={`translate(${24 + index * 12} ${30 + index * 14})`}>
          <rect width="56" height="20" rx="5" fill={palette.flesh} />
          <rect width="56" height="20" rx="5" fill={palette.sheen} />
          <path
            d="M8 5 q6 5 0 10 M20 4 q7 6 1 12 M34 5 q6 5 0 10"
            stroke={palette.marble}
            strokeWidth="1.8"
            fill="none"
          />
          <circle cx="48" cy="10" r="4.5" fill={palette.marble} opacity="0.85" />
          <rect y="15" width="56" height="5" rx="2.5" fill={palette.fleshDeep} opacity="0.6" />
        </g>
      ))}
    </g>
  );
}

function Steak({ palette }: ShapeProps) {
  return (
    <g transform="translate(26 30)">
      <path
        d="M4 22 q-6 -18 14 -21 q26 -4 40 8 q14 12 4 26 q-10 14 -32 10 q-22 -4 -26 -23 Z"
        fill={palette.flesh}
      />
      <path
        d="M4 22 q-6 -18 14 -21 q26 -4 40 8 q14 12 4 26 q-10 14 -32 10 q-22 -4 -26 -23 Z"
        fill={palette.sheen}
      />
      <path
        d="M14 20 q10 -6 20 -2 M18 30 q12 -5 24 0 M22 40 q10 -4 18 -1 M30 12 q8 -3 14 1"
        stroke={palette.marble}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M4 22 q-6 -18 14 -21 q26 -4 40 8"
        stroke={palette.glaze}
        strokeWidth="2.5"
        fill="none"
        opacity="0.7"
      />
    </g>
  );
}

function Strips({ palette }: ShapeProps) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((index) => (
        <g
          key={index}
          transform={`translate(${20 + (index % 2) * 26} ${26 + index * 11}) rotate(${index % 2 ? 8 : -8})`}
        >
          <rect width="52" height="11" rx="5.5" fill={palette.flesh} />
          <rect width="52" height="11" rx="5.5" fill={palette.sheen} />
          <rect width="52" height="11" rx="5.5" fill={palette.glaze} opacity="0.32" />
          <circle cx="14" cy="5.5" r="1.6" fill={palette.marble} opacity="0.9" />
          <circle cx="34" cy="6" r="1.4" fill={palette.marble} opacity="0.75" />
        </g>
      ))}
    </g>
  );
}

function BellyRolls({ palette }: ShapeProps) {
  return (
    <g>
      {[0, 1, 2].map((index) => (
        <g key={index} transform={`translate(${22 + index * 20} ${32 + index * 16})`}>
          <rect width="50" height="18" rx="9" fill={palette.flesh} />
          <rect width="50" height="18" rx="9" fill={palette.sheen} />
          <rect x="2" y="4" width="46" height="4" rx="2" fill={palette.marble} opacity="0.9" />
          <rect
            x="2"
            y="11"
            width="46"
            height="3.5"
            rx="1.75"
            fill={palette.marble}
            opacity="0.7"
          />
          <rect y="14" width="50" height="4" rx="2" fill={palette.fleshDeep} opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

function Rounds({ palette, count, radius }: ShapeProps & { count: number; radius: number }) {
  const positions = [
    [40, 40],
    [72, 34],
    [56, 62],
    [88, 62],
    [34, 68],
    [70, 86],
  ] as const;

  return (
    <g>
      {positions.slice(0, count).map(([cx, cy], index) => (
        <g key={index}>
          <circle cx={cx} cy={cy} r={radius} fill={palette.flesh} />
          <circle cx={cx} cy={cy} r={radius} fill={palette.sheen} />
          <circle cx={cx} cy={cy} r={radius * 0.58} fill={palette.marble} opacity="0.55" />
          <circle cx={cx} cy={cy} r={radius * 0.28} fill={palette.fleshDeep} opacity="0.45" />
        </g>
      ))}
    </g>
  );
}

function Cubes({ palette }: ShapeProps) {
  const positions = [
    [30, 36],
    [58, 30],
    [82, 44],
    [40, 62],
    [68, 60],
    [50, 84],
    [82, 78],
  ] as const;

  return (
    <g>
      {positions.map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y}) rotate(${(index * 27) % 40})`}>
          <rect width="20" height="17" rx="5" fill={palette.flesh} />
          <rect width="20" height="17" rx="5" fill={palette.sheen} />
          <path d="M4 12 q6 -6 12 -2" stroke={palette.marble} strokeWidth="1.6" fill="none" />
        </g>
      ))}
    </g>
  );
}

function Fillets({ palette }: ShapeProps) {
  return (
    <g>
      {[0, 1, 2].map((index) => (
        <g key={index} transform={`translate(${24 + index * 14} ${30 + index * 17}) rotate(-6)`}>
          <path
            d="M0 10 q6 -12 26 -10 q22 2 26 10 q-6 11 -26 11 q-20 0 -26 -11 Z"
            fill={palette.flesh}
          />
          <path
            d="M0 10 q6 -12 26 -10 q22 2 26 10 q-6 11 -26 11 q-20 0 -26 -11 Z"
            fill={palette.sheen}
          />
          <path
            d="M12 8 q14 -4 26 0 M14 15 q12 -3 22 0"
            stroke={palette.marble}
            strokeWidth="1.5"
            fill="none"
          />
        </g>
      ))}
    </g>
  );
}

function Prawns({ palette }: ShapeProps) {
  const positions = [
    [34, 34],
    [70, 30],
    [46, 62],
    [82, 58],
    [58, 86],
  ] as const;

  return (
    <g>
      {positions.map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y}) rotate(${index * 34 - 20})`}>
          <path
            d="M0 12 q0 -12 13 -12 q13 0 13 12 q0 10 -9 10 q-8 0 -8 -7"
            fill="none"
            stroke={palette.flesh}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M0 12 q0 -12 13 -12 q13 0 13 12"
            fill="none"
            stroke={palette.marble}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>
      ))}
    </g>
  );
}

function Rings({ palette }: ShapeProps) {
  const positions = [
    [38, 38, 12],
    [70, 34, 10],
    [54, 64, 13],
    [86, 62, 9],
    [40, 78, 10],
  ] as const;

  return (
    <g>
      {positions.map(([cx, cy, r], index) => (
        <g key={index}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.flesh} strokeWidth={r * 0.55} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={palette.marble}
            strokeWidth="1.4"
            opacity="0.55"
          />
        </g>
      ))}
    </g>
  );
}

function SalmonFillet({ palette }: ShapeProps) {
  return (
    <g>
      {[0, 1].map((index) => (
        <g key={index} transform={`translate(${22 + index * 22} ${34 + index * 26}) rotate(-8)`}>
          <path
            d="M0 14 q10 -14 34 -14 q30 0 42 14 q-12 14 -42 14 q-24 0 -34 -14 Z"
            fill={palette.flesh}
          />
          <path
            d="M0 14 q10 -14 34 -14 q30 0 42 14 q-12 14 -42 14 q-24 0 -34 -14 Z"
            fill={palette.sheen}
          />
          <path
            d="M10 8 q20 -4 40 0 M12 15 q20 -4 38 0 M16 21 q18 -3 32 0"
            stroke={palette.marble}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

function renderVariant(variant: VisualVariant, palette: Palette) {
  switch (variant) {
    case 'slices-fanned':
      return <Slices palette={palette} />;
    case 'ribs-stacked':
      return <Ribs palette={palette} />;
    case 'steak-marbled':
      return <Steak palette={palette} />;
    case 'strips-marinated':
      return <Strips palette={palette} />;
    case 'belly-rolled':
      return <BellyRolls palette={palette} />;
    case 'tongue-rounds':
      return <Rounds palette={palette} count={5} radius={13} />;
    case 'jowl-curled':
      return <Rounds palette={palette} count={4} radius={16} />;
    case 'cubes-scattered':
      return <Cubes palette={palette} />;
    case 'fillets-layered':
      return <Fillets palette={palette} />;
    case 'prawns-curled':
      return <Prawns palette={palette} />;
    case 'squid-rings':
      return <Rings palette={palette} />;
    case 'salmon-fillet':
      return <SalmonFillet palette={palette} />;
    case 'scallops-round':
      return <Rounds palette={palette} count={6} radius={11} />;
  }
}

interface FoodIllustrationProps {
  food: FoodItem;
  className?: string;
}

/**
 * A stylised overhead plate. All foods share the ceramic plate and lighting;
 * the arrangement and palette carry the difference between cuts.
 */
export function FoodIllustration({ food, className }: FoodIllustrationProps) {
  const uid = useId().replace(/:/g, '');
  const sheenId = `sheen-${uid}`;
  const palette: Palette = { ...PALETTES[food.category], sheen: `url(#${sheenId})` };

  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`plate-${uid}`} cx="38%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#3A322A" />
          <stop offset="55%" stopColor="#241E19" />
          <stop offset="100%" stopColor="#141110" />
        </radialGradient>
        <linearGradient id={sheenId} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`plate-clip-${uid}`}>
          <circle cx="64" cy="64" r="49" />
        </clipPath>
      </defs>

      <ellipse cx="66" cy="72" rx="54" ry="52" fill="#0A0908" opacity="0.7" />
      <circle cx="64" cy="64" r="57" fill={`url(#plate-${uid})`} />
      <circle cx="64" cy="64" r="57" fill="none" stroke="#4A3E33" strokeWidth="1.5" opacity="0.8" />
      <circle cx="64" cy="64" r="49" fill="none" stroke="#5C4B3B" strokeWidth="1" opacity="0.5" />

      <g clipPath={`url(#plate-clip-${uid})`}>{renderVariant(food.visualVariant, palette)}</g>

      <path
        d="M26 34 a52 52 0 0 1 42 -22"
        fill="none"
        stroke="#F3E8D0"
        strokeWidth="2"
        opacity="0.18"
        strokeLinecap="round"
      />
    </svg>
  );
}
