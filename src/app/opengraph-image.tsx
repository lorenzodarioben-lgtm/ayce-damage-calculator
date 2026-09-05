import { ImageResponse } from 'next/og';
import { FOODS } from '@/data/foods';
import { CARD_COLOURS } from '@/lib/resultCard';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AYCE Damage Calculator — did you beat the buffet?';

/**
 * The preview the app itself shows when its link is posted somewhere.
 *
 * It used to be the 512px app icon: square, cropped by most feeds, and saying
 * nothing about what the thing does. This says the one sentence the app exists
 * to ask, and states the three facts that make it worth opening.
 *
 * Built on the same terms as the shared-report card beside it — palette and
 * type only, no photograph and no font fetch — so it renders identically
 * wherever it is generated and adds no external dependency. The display face
 * ships as WOFF2, which this renderer cannot read, so the weight here is the
 * renderer's own.
 */

const CREDENTIALS = [
  [`${FOODS.length} cuts`, 'Built-in catalogue'],
  ['No account', 'Nothing to sign up for'],
  ['On device', 'Nothing leaves the browser'],
] as const;

export default function Image() {
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
          // The same warm pendant light the app sits under, from the same corner.
          backgroundImage:
            'radial-gradient(900px 520px at 18% -12%, rgba(201,149,87,0.30), rgba(13,12,10,0) 68%),' +
            'radial-gradient(760px 420px at 88% 108%, rgba(122,51,36,0.34), rgba(13,12,10,0) 70%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{ width: 6, height: 34, borderRadius: 3, backgroundColor: CARD_COLOURS.ember }}
          />
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: CARD_COLOURS.ember,
            }}
          >
            AYCE Damage Calculator
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <span
            style={{
              fontSize: 104,
              fontWeight: 800,
              lineHeight: 0.94,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              color: CARD_COLOURS.cream,
            }}
          >
            Did you beat
          </span>
          <span
            style={{
              fontSize: 104,
              fontWeight: 800,
              lineHeight: 0.94,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              color: CARD_COLOURS.ember,
            }}
          >
            the buffet?
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: `2px solid ${CARD_COLOURS.line}`,
            paddingTop: 30,
          }}
        >
          {CREDENTIALS.map(([value, label]) => (
            <div key={value} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: CARD_COLOURS.cream,
                }}
              >
                {value}
              </span>
              <span
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: CARD_COLOURS.faint,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
