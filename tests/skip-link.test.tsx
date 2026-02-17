// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLink } from '@/components/nav/SkipLink';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

/*
 * The skip link is rendered once, by the root layout, for every route. It is
 * only useful if the page it lands on actually carries the id it points at, and
 * that is an agreement between two files that never import each other — so it
 * is checked here rather than left to be noticed by whoever needs it most.
 */

/** Renders its own document without the root layout, so no skip link reaches it. */
const OWN_DOCUMENT = new Set(['global-error.tsx']);

function filesRenderingMain(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...filesRenderingMain(path));
      continue;
    }
    if (!entry.name.endsWith('.tsx') || OWN_DOCUMENT.has(entry.name)) {
      continue;
    }
    if (readFileSync(path, 'utf8').includes('<main')) {
      found.push(path);
    }
  }

  return found;
}

describe('SkipLink', () => {
  it('points at the id the pages agree to carry', () => {
    render(<SkipLink />);

    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute(
      'href',
      `#${MAIN_CONTENT_ID}`,
    );
  });
});

describe('the target it depends on', () => {
  const files = filesRenderingMain(join(process.cwd(), 'src', 'app'));

  it('is looked for in a meaningful number of places', () => {
    // Guards the scan itself: a broken path would otherwise pass silently.
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('is present in %s', (path) => {
    // The literal would drift; every page reaches for the shared constant.
    expect(readFileSync(path, 'utf8')).toContain('MAIN_CONTENT_ID');
  });
});
