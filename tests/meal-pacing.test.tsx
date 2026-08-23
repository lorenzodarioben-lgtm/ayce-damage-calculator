import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealPacing } from '@/components/live/MealPacing';
import { buildDamageReport } from '@/lib/calculations';
import type { MealItem } from '@/types/meal';
import type { MealLifecycle } from '@/types/mealEvents';

const START = Date.parse('2026-08-16T18:00:00.000Z');

function at(minutes: number): string {
  return new Date(START + minutes * 60_000).toISOString();
}

const items: readonly MealItem[] = [
  {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 8,
  },
];

const report = buildDamageReport(items, { pricePerDiner: 59.9, dinerCount: 1 });

const running: MealLifecycle = { status: 'active', startedAt: at(0), pausedMs: 0 };

function renderPacing(
  overrides: {
    lifecycle?: MealLifecycle;
    plannedDurationMinutes?: number | undefined;
  } = {},
) {
  const handlers = {
    onDurationChange: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onFinish: vi.fn(),
  };
  render(
    <MealPacing
      report={report}
      lifecycle={overrides.lifecycle ?? { status: 'idle', pausedMs: 0 }}
      plannedDurationMinutes={overrides.plannedDurationMinutes}
      {...handlers}
    />,
  );
  return handlers;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(START + 30 * 60_000));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MealPacing', () => {
  it('offers meal lengths without forcing one', () => {
    renderPacing();

    const lengths = screen.getByRole('group', { name: 'Meal length' });
    expect(within(lengths).getByRole('button', { name: '60 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(lengths).getByRole('button', { name: 'No limit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/no time limit set/i)).toBeInTheDocument();
  });

  it('books a preset window when one is chosen', async () => {
    const user = userEvent.setup();
    const handlers = renderPacing();

    await user.click(screen.getByRole('button', { name: '90 min' }));

    expect(handlers.onDurationChange).toHaveBeenCalledWith(90);
  });

  it('clears the window again', async () => {
    const user = userEvent.setup();
    const handlers = renderPacing({ plannedDurationMinutes: 90 });

    await user.click(screen.getByRole('button', { name: 'No limit' }));

    expect(handlers.onDurationChange).toHaveBeenCalledWith(undefined);
  });

  it('accepts a validated custom length', async () => {
    const user = userEvent.setup();
    const handlers = renderPacing();

    await user.click(screen.getByRole('button', { name: 'Custom' }));
    const field = screen.getByLabelText('Custom length in minutes');
    await user.clear(field);
    await user.type(field, '45');
    await user.click(screen.getByRole('button', { name: 'Set length' }));

    expect(handlers.onDurationChange).toHaveBeenCalledWith(45);
    expect(field).toHaveAttribute('min', '15');
    expect(field).toHaveAttribute('max', '300');
  });

  it('describes the countdown to assistive technology without reading the seconds', () => {
    renderPacing({ lifecycle: running, plannedDurationMinutes: 90 });

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    expect(bar).toHaveAttribute('aria-valuetext', '30 minutes elapsed, 1 hour remaining');
    // The ticking digits are decoration; the progress bar carries the meaning.
    expect(screen.getByText('1:00:00')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the pace it has and the pace break-even would take', () => {
    renderPacing({ lifecycle: running, plannedDurationMinutes: 90 });

    expect(screen.getByText('Plates per hour')).toBeInTheDocument();
    expect(screen.getByText('16.0/hr')).toBeInTheDocument();
    expect(screen.getByText('Pace to break even')).toBeInTheDocument();
    expect(screen.getByText('Time eaten')).toBeInTheDocument();
  });

  it('offers pause and finish while the meal is running', async () => {
    const user = userEvent.setup();
    const handlers = renderPacing({ lifecycle: running, plannedDurationMinutes: 90 });

    await user.click(screen.getByRole('button', { name: 'Pause meal' }));
    expect(handlers.onPause).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Finish meal' }));
    expect(handlers.onFinish).toHaveBeenCalled();
  });

  it('offers resume instead once the meal is paused', async () => {
    const user = userEvent.setup();
    const handlers = renderPacing({
      lifecycle: { status: 'paused', startedAt: at(0), pausedAt: at(20), pausedMs: 0 },
      plannedDurationMinutes: 90,
    });

    expect(screen.queryByRole('button', { name: 'Pause meal' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resume meal' }));
    expect(handlers.onResume).toHaveBeenCalled();
  });

  it('offers no timer controls at all before the meal has started', () => {
    renderPacing({ plannedDurationMinutes: 90 });

    expect(screen.queryByRole('button', { name: 'Pause meal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish meal' })).not.toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  it('will not project from a meal that has barely begun', () => {
    vi.setSystemTime(new Date(START + 30_000));
    renderPacing({ lifecycle: running, plannedDurationMinutes: 90 });

    expect(screen.getByText('Too early')).toBeInTheDocument();
    expect(screen.getByText(/projections need a few minutes/i)).toBeInTheDocument();
  });

  it('says the window is over rather than counting past it', () => {
    vi.setSystemTime(new Date(START + 120 * 60_000));
    renderPacing({ lifecycle: running, plannedDurationMinutes: 90 });

    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText(/booked window is over/i)).toBeInTheDocument();
  });

  it('states plainly that the forecast is an extrapolation, not a target', () => {
    renderPacing({ lifecycle: running, plannedDurationMinutes: 90 });

    expect(screen.getByText(/not promises/i)).toBeInTheDocument();
    expect(screen.getByText(/nobody has to eat to a number/i)).toBeInTheDocument();
  });

  it('leaves a finished meal frozen where it stopped', () => {
    vi.setSystemTime(new Date(START + 600 * 60_000));
    renderPacing({
      lifecycle: { status: 'completed', startedAt: at(0), completedAt: at(60), pausedMs: 0 },
      plannedDurationMinutes: 90,
    });

    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.getByText('30:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish meal' })).toBeDisabled();
  });
});
