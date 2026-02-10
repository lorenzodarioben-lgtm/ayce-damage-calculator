// @vitest-environment node
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';
import { DESTINATIONS } from '@/components/nav/destinations';
import { THEME_COLOUR } from '@/lib/constants';

describe('web app manifest', () => {
  it('offers the meal, from before it to across all of them', () => {
    const shortcuts = manifest().shortcuts ?? [];

    expect(shortcuts.map((shortcut) => shortcut.url)).toEqual([
      '/live',
      '/plan',
      '/history',
      '/stats',
    ]);
  });

  it('only points at destinations the app actually navigates to', () => {
    const routes = new Set(DESTINATIONS.map((destination) => destination.href));

    for (const shortcut of manifest().shortcuts ?? []) {
      expect(routes.has(shortcut.url)).toBe(true);
    }
  });

  it('does not spend a shortcut on the page the launcher already opens', () => {
    const { start_url: startUrl, shortcuts = [] } = manifest();

    expect(startUrl).toBe('/');
    expect(shortcuts.map((shortcut) => shortcut.url)).not.toContain(startUrl);
  });

  it('names every shortcut for both a wide and a narrow launcher', () => {
    for (const shortcut of manifest().shortcuts ?? []) {
      expect(shortcut.name).toBeTruthy();
      expect(shortcut.short_name).toBeTruthy();
      expect(shortcut.description).toBeTruthy();
    }
  });

  it('paints its chrome the same colour as the app', () => {
    const { theme_color: theme, background_color: background } = manifest();

    expect(theme).toBe(THEME_COLOUR);
    expect(background).toBe(THEME_COLOUR);
  });
});
