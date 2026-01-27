import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealReplay, UntimedMealNotice } from '@/components/history/MealReplay';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { buildMealReplay } from '@/lib/replay';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealSession } from '@/types/meal';
import type { MealEvent } from '@/types/mealEvents';

const START = Date.parse('2026-08-16T18:00:00.000Z');

function at(minutes: number): string {
  return new Date(START + minutes * 60_000).toISOString();
}

function added(index: number, minutes: number, quantity = 1, dinerId?: string): MealEvent {
  return {
    id: `event-${index}`,
    at: at(minutes),
    seq: index,
    source: 'live',
    type: 'plates-added',
    line: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular' },
    quantity,
    ...(dinerId ? { dinerId } : {}),
  };
}

function filedMeal(
  events: readonly MealEvent[],
  overrides: Partial<MealSession> = {},
): SavedMealSession {
  const plates = events.reduce(
    (sum, event) => (event.type === 'plates-added' ? sum + event.quantity : sum),
    0,
  );
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [
      {
        id: 'beef-ribeye__standard__regular',
        foodId: 'beef-ribeye',
        quality: 'standard',
        plateSize: 'regular',
        quantity: plates,
      },
    ],
    events,
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(session, report, getVerdict(1, 1), {
    id: 'record-1',
    createdAt: at(0),
  });
}

/** Strips the ledger, which is how a record filed before it existed reads. */
function withoutLedger(filed: SavedMealSession): SavedMealSession {
  const { events: _events, lifecycle: _lifecycle, ...untimed } = filed;
  return untimed;
}

function renderReplay(record: SavedMealSession) {
  render(
    <MealReplay replay={buildMealReplay(record)} record={record} headingId="replay-heading" />,
  );
}

const TEN_PLATES = Array.from({ length: 10 }, (_unused, index) => added(index, index * 6));

describe('MealReplay', () => {
  it('describes the chart in words as well as drawing it', () => {
    renderReplay(filedMeal(TEN_PLATES));

    const chart = screen.getByRole('img');
    expect(within(chart).getByText(/retail recovery across/i)).toBeInTheDocument();
    expect(within(chart).getByText(/rising from/i)).toBeInTheDocument();
  });

  it('offers the same series as a table', async () => {
    const user = userEvent.setup();
    renderReplay(filedMeal(TEN_PLATES));

    await user.click(screen.getByText('Show the timeline as figures'));

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).getByRole('columnheader', { name: 'Recovery' })).toBeInTheDocument();
  });

  it('opens at the end of the meal', () => {
    renderReplay(filedMeal(TEN_PLATES));

    const scrubber = screen.getByLabelText('Scrub the meal');
    expect(scrubber).toHaveAttribute('aria-valuetext', expect.stringContaining('10 plates'));
  });

  it('scrubs back to an earlier state of the same meal', () => {
    renderReplay(filedMeal(TEN_PLATES));

    const scrubber = screen.getByLabelText('Scrub the meal');
    // Six minutes in, exactly two plates had landed.
    fireEvent.change(scrubber, { target: { value: String(6 * 60_000) } });

    expect(scrubber).toHaveAttribute('aria-valuetext', '6:00 in, 2 plates, 27% recovered');
  });

  it('names the moments worth naming', () => {
    renderReplay(filedMeal(TEN_PLATES));

    expect(screen.getByText('First plate')).toBeInTheDocument();
    expect(screen.getByText('Break-even')).toBeInTheDocument();
    expect(screen.getByText('Last plate')).toBeInTheDocument();
  });

  it('offers playback controls that toggle', async () => {
    const user = userEvent.setup();
    renderReplay(filedMeal(TEN_PLATES));

    await user.click(screen.getByRole('button', { name: 'Play replay' }));
    expect(screen.getByRole('button', { name: 'Pause replay' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause replay' }));
    expect(screen.getByRole('button', { name: 'Play replay' })).toBeInTheDocument();
  });

  it('restarts to the beginning of the meal', async () => {
    const user = userEvent.setup();
    renderReplay(filedMeal(TEN_PLATES));

    await user.click(screen.getByRole('button', { name: 'Restart' }));

    expect(screen.getByLabelText('Scrub the meal')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('1 plate,'),
    );
  });

  it('shows diner contributions when the record has them', () => {
    renderReplay(
      filedMeal([added(0, 0, 2, 'lorenzo'), added(1, 8, 1, 'omar')], {
        dinerCount: 2,
        diners: [
          { id: 'lorenzo', displayName: 'Lorenzo' },
          { id: 'omar', displayName: 'Omar' },
        ],
      }),
    );

    expect(screen.getByText('Lorenzo')).toBeInTheDocument();
    expect(screen.getByText('Omar')).toBeInTheDocument();
  });

  it('renders nothing at all for a record with no ledger', () => {
    const { container } = render(
      <MealReplay
        replay={buildMealReplay(withoutLedger(filedMeal(TEN_PLATES)))}
        record={filedMeal(TEN_PLATES)}
        headingId="replay-heading"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('UntimedMealNotice', () => {
  it('says the timing was never recorded rather than implying it was lost', () => {
    render(<UntimedMealNotice headingId="replay-heading" />);

    expect(screen.getByText(/detailed timing was not recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/exactly as they were recorded/i)).toBeInTheDocument();
  });
});
