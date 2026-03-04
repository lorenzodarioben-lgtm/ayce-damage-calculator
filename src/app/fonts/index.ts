import localFont from 'next/font/local';

/**
 * The three typefaces, loaded from files kept in this repository.
 *
 * `next/font/local` rather than `next/font/google` on purpose. The Google
 * loader downloads its files during `next build`, which makes the build need a
 * network and makes two builds of the same commit depend on what a CDN served
 * that day. These are checked in instead, so an offline machine and a
 * restricted CI runner both produce exactly the same bytes — which is the same
 * reasoning that keeps the share codec's arithmetic inside the project.
 *
 * Each is subset to latin, declared `swap` so text is legible before the file
 * lands, and given the system fallback it is closest to in metrics so the
 * reflow when it arrives is as small as it can be. All three are SIL Open Font
 * Licence 1.1; see `fonts/OFL.txt`.
 */

/**
 * Anton, for the few places the app raises its voice: the hero, the verdict and
 * the headline figure on the result card. One weight, very tight sidebearings,
 * and unmistakable at 96px — which is the entire job.
 */
export const displayFont = localFont({
  src: './anton-latin.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-display-face',
  // Impact is the metric-compatible fallback, and the stack it replaces.
  fallback: ['Impact', 'Haettenschweiler', 'Arial Narrow Bold', 'sans-serif'],
  adjustFontFallback: false,
});

/**
 * Oswald, for section headings, cut names and the small uppercase labels.
 *
 * Variable across 200–700, which is what Impact could never offer: the same
 * condensed voice reads as a heading at 600 and as a quiet label at 500,
 * instead of one weight being shouted at every size.
 */
export const headingFont = localFont({
  src: './oswald-latin-var.woff2',
  weight: '200 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-heading-face',
  fallback: ['Arial Narrow', 'Roboto Condensed', 'sans-serif'],
  adjustFontFallback: false,
});

/**
 * Inter, for everything that has to be read rather than looked at.
 *
 * Chosen for its figures more than its letters. This app is mostly numbers in
 * columns — a tab, a receipt, a comparison — and Inter's tabular figures are
 * the same width to the pixel, so a total stops shifting sideways as it counts
 * up.
 */
export const textFont = localFont({
  src: './inter-latin-var.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-sans-face',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
  adjustFontFallback: false,
});

/** Every font variable, for the element that opens the document. */
export const fontVariables = [displayFont.variable, headingFont.variable, textFont.variable].join(
  ' ',
);
