import { ImageResponse } from 'next/og';
import { CARD_COLOURS } from '@/lib/resultCard';
import { socialCardFromToken } from '@/lib/socialCard';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AYCE Damage Report';

/**
 * The preview a shared report shows when it is posted somewhere.
 *
 * Drawn entirely from the token, with no network access and no external assets,
 * so it renders identically wherever it is generated. Only four figures make it
 * in: at feed size, anything more stops being readable and starts being texture.
 *
 * Typography is the renderer's own — the app's display face ships as WOFF2,
 * which this renderer cannot use, and fetching a font would break the "no
 * external dependency" rule the rest of the project keeps.
 */

interface Props {
  params: Promise<{ token: string }>;
}

function Figure({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontSize: 60,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: accent ? CARD_COLOURS.ember : CARD_COLOURS.cream,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: CARD_COLOURS.faint,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default async function Image({ params }: Props) {
  const { token } = await params;
  const card = socialCardFromToken(token);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: CARD_COLOURS.bg,
          padding: '64px 72px',
          // The warm pendant light the rest of the app sits under.
          backgroundImage: `radial-gradient(1000px 520px at 50% -10%, rgba(169,122,65,0.28), rgba(13,12,10,0) 70%)`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: CARD_COLOURS.ember,
            }}
          >
            AYCE Damage Report
          </span>
          {card.restaurantName ? (
            <span style={{ fontSize: 26, color: CARD_COLOURS.muted }}>{card.restaurantName}</span>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span
            style={{
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              color: CARD_COLOURS.cream,
            }}
          >
            {card.verdictTitle}
          </span>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: CARD_COLOURS.muted,
            }}
          >
            {card.plates}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: `2px solid ${CARD_COLOURS.line}`,
            paddingTop: 32,
          }}
        >
          <Figure value={card.retailValue} label="Est. retail value" />
          <Figure value={card.admission} label="Admission" />
          <Figure value={card.recovery} label="Retail recovery" accent />
        </div>
      </div>
    ),
    { ...size },
  );
}
