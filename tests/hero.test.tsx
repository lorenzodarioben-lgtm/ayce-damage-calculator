import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Hero } from '@/components/Hero';

/*
 * The heading is split across a line break for the sake of the layout, which is
 * a typographic decision rather than a semantic one: it still has to read as
 * one sentence to anything that does not draw the page, and it is the only
 * level-one heading the landing route carries.
 */

describe('Hero', () => {
  it('carries exactly one level-one heading', () => {
    render(<Hero />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('asks the question the app exists to answer, across the line break', () => {
    render(<Hero />);

    /*
     * The break is there for the layout alone; the two halves are one question.
     * The gap is left flexible because jsdom does not insert the space a
     * browser's name computation puts in the place of the break.
     */
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Did you beat\s*the buffet\?$/,
    );
  });

  it('names the calculator above the question', () => {
    render(<Hero />);

    expect(screen.getByText('AYCE Damage Calculator')).toBeInTheDocument();
  });

  it('explains what the diner is about to do', () => {
    render(<Hero />);

    expect(screen.getByText(/track the plates/i)).toBeInTheDocument();
    expect(screen.getByText(/calculate the damage/i)).toBeInTheDocument();
    expect(screen.getByText(/money’s worth/i)).toBeInTheDocument();
  });
});
