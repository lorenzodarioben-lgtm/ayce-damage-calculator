import { ImageResponse } from 'next/og';
import { buildChallengeCardModel } from '@/lib/challengeCard';
import { CARD_COLOURS } from '@/lib/resultCard';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AYCE Damage Challenge';

/**
 * The preview a shared challenge shows when it is posted somewhere.
 *
 * Drawn entirely from the token, with no network access and no external
 * assets, exactly like the report's own card. Every figure is decoded and
 * recomputed here — none of it is text the sender supplied.
 */

interface Props {
  params: Promise<{ token: string }>;
}

function Side({ label, recovery, accent }: { label: string; recovery: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        flex: 1,
      }}
    >
      <span
        style={{
          fontSize: 112,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: accent ? CARD_COLOURS.ember : CARD_COLOURS.cream,
        }}
      >
        {recovery}
      </span>
      <span
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: CARD_COLOURS.faint,
        }}
      >
        {label || 'Unnamed'}
      </span>
    </div>
  );
}

export default async function Image({ params }: Props) {
  const { token } = await params;
  const card = buildChallengeCardModel(token);

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
          backgroundImage:
            'radial-gradient(1000px 520px at 50% -10%, rgba(169,122,65,0.28), rgba(13,12,10,0) 70%)',
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: CARD_COLOURS.ember,
          }}
        >
          AYCE Damage Challenge
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Side label={card.previousLabel} recovery={card.previousRecovery} />
          <span
            style={{
              fontSize: 44,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: CARD_COLOURS.muted,
            }}
          >
            vs
          </span>
          <Side label={card.currentLabel} recovery={card.currentRecovery} accent />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            borderTop: `2px solid ${CARD_COLOURS.line}`,
            paddingTop: 32,
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: CARD_COLOURS.muted,
            }}
          >
            {card.shift} of retail recovery
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
