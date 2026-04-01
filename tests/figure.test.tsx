import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Figure } from '@/components/ui/Figure';

describe('Figure', () => {
  it('keeps a label, measurement and optional qualifier in definition-list semantics', () => {
    render(
      <dl>
        <Figure label="Retail recovery" value="128%" detail="Across the whole table" />
      </dl>,
    );

    expect(screen.getByText('Retail recovery').tagName).toBe('DT');
    expect(screen.getByText('128%').tagName).toBe('DD');
    expect(screen.getByText('Across the whole table')).toBeInTheDocument();
  });

  it('uses the named recovered tone for a measurement above break-even', () => {
    const { container } = render(
      <dl>
        <Figure label="Recovery" value="100%" tone="recovered" />
      </dl>,
    );

    expect(container.querySelector('dd')).toHaveClass('text-sesame-400');
  });
});
