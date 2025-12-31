import { CARD_COLOURS, CARD_FOOTER, type CardStat, type ResultCardModel } from '@/lib/resultCard';

interface ResultCardProps {
  model: ResultCardModel;
}

const TONE_COLOURS = {
  cream: CARD_COLOURS.cream,
  ember: CARD_COLOURS.ember,
  green: CARD_COLOURS.green,
  red: CARD_COLOURS.red,
} as const;

function Divider() {
  return <div style={{ height: 1, backgroundColor: CARD_COLOURS.line, width: '100%' }} />;
}

function Stat({ stat }: { stat: CardStat }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
      <p
        style={{
          margin: 0,
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: CARD_COLOURS.faint,
          fontWeight: 600,
        }}
      >
        {stat.label}
      </p>
      <p
        className="tabular display-type"
        style={{
          margin: '5px 0 0',
          fontSize: 26,
          color: TONE_COLOURS[stat.tone],
          lineHeight: 1,
          overflowWrap: 'anywhere',
        }}
      >
        {stat.value}
      </p>
    </div>
  );
}

function StatRow({ stats }: { stats: readonly [CardStat, CardStat] }) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {stats.map((stat) => (
        <Stat key={stat.label} stat={stat} />
      ))}
    </div>
  );
}

/**
 * The on-screen preview of the shareable card. Colours are written literally
 * rather than through theme utilities so it reads as one self-contained object.
 */
export function ResultCard({ model }: ResultCardProps) {
  return (
    <div
      style={{
        width: 420,
        maxWidth: '100%',
        backgroundColor: CARD_COLOURS.bg,
        border: `1px solid ${CARD_COLOURS.line}`,
        borderRadius: 16,
        padding: 24,
        boxSizing: 'border-box',
        color: CARD_COLOURS.cream,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <header style={{ textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: CARD_COLOURS.ember,
            fontWeight: 700,
          }}
        >
          AYCE Damage Report
        </p>
        {model.restaurantName && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: CARD_COLOURS.muted,
              overflowWrap: 'anywhere',
            }}
          >
            {model.restaurantName}
          </p>
        )}
      </header>

      <Divider />

      <div style={{ textAlign: 'center' }}>
        <p
          className="display-type"
          style={{ margin: 0, fontSize: 40, lineHeight: 0.95, color: CARD_COLOURS.cream }}
        >
          {model.verdictTitle}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: CARD_COLOURS.muted }}>
          {model.verdictCopy}
        </p>
      </div>

      <Divider />

      <StatRow stats={model.volume} />

      <div
        style={{
          backgroundColor: CARD_COLOURS.panel,
          border: `1px solid ${CARD_COLOURS.line}`,
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <StatRow stats={model.money} />
        <Divider />
        <StatRow stats={model.outcome} />
      </div>

      <StatRow stats={model.nutrition} />

      <Divider />

      <p
        style={{
          margin: 0,
          textAlign: 'center',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: CARD_COLOURS.faint,
        }}
      >
        {CARD_FOOTER}
      </p>
    </div>
  );
}
