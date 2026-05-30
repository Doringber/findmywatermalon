/**
 * colorAnalysis.ts
 *
 * Pure, testable functions that turn raw camera pixels into watermelon ripeness
 * signals. The heuristics encode well-established produce-picking research:
 *
 *  - A ripe watermelon has a creamy YELLOW "field spot" (where it rested on the
 *    ground ripening on the vine). The bigger and creamier the yellow, the
 *    sweeter the melon. A white/pale spot means under-ripe.
 *  - The rind should show DEEP, DULL green (not shiny) with darker green stripes
 *    ("webbing"), a sign of good pollination and sugar.
 *
 * Sources are documented in README.md.
 */

export interface Hsv {
  /** Hue in degrees [0, 360). */
  h: number;
  /** Saturation [0, 1]. */
  s: number;
  /** Value / brightness [0, 1]. */
  v: number;
}

/** Convert an 8-bit RGB triple to HSV. */
export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

export type PixelClass = 'green' | 'darkGreen' | 'fieldSpot' | 'creamyYellow' | 'other';

/** Classify a single pixel into a watermelon-relevant colour bucket. */
export function classifyPixel(r: number, g: number, b: number): PixelClass {
  const { h, s, v } = rgbToHsv(r, g, b);

  // Creamy / buttery yellow field spot — the strongest ripeness signal.
  // A genuinely ripe spot is yellow with decent saturation and brightness.
  if (h >= 38 && h <= 65 && s >= 0.25 && v >= 0.45) {
    return 'creamyYellow';
  }
  // Paler yellow field spot (still good, just less intense).
  if (h >= 35 && h <= 68 && s >= 0.12 && v >= 0.35) {
    return 'fieldSpot';
  }
  // Green rind. Dark, dull greens indicate the stripe "webbing".
  if (h >= 65 && h <= 175 && s >= 0.18 && v >= 0.1) {
    return v < 0.4 ? 'darkGreen' : 'green';
  }
  return 'other';
}

export interface ColorMetrics {
  /** Total pixels sampled. */
  total: number;
  /** Fraction of pixels that read as green rind (incl. dark stripes). */
  greenRatio: number;
  /** Fraction of pixels that read as dark-green stripe / webbing. */
  darkGreenRatio: number;
  /** Fraction of pixels that read as creamy/pale yellow field spot. */
  fieldSpotRatio: number;
  /** Fraction of yellow that is the "creamy" (ripest) variety. */
  creaminess: number;
}

/**
 * Analyse a flat RGBA pixel buffer (as produced by CanvasRenderingContext2D
 * `getImageData().data`). Returns ratios that downstream scoring consumes.
 *
 * `step` lets callers subsample for performance (default: every pixel).
 */
export function analyzeColors(rgba: ArrayLike<number>, step = 1): ColorMetrics {
  if (rgba.length < 4 || rgba.length % 4 !== 0) {
    throw new Error('Expected an RGBA buffer with length a multiple of 4.');
  }

  let total = 0;
  let green = 0;
  let darkGreen = 0;
  let fieldSpot = 0;
  let creamy = 0;

  const stride = Math.max(1, Math.floor(step)) * 4;
  for (let i = 0; i + 3 < rgba.length; i += stride) {
    const alpha = rgba[i + 3];
    if (alpha === 0) continue; // skip fully transparent pixels
    total++;
    const cls = classifyPixel(rgba[i], rgba[i + 1], rgba[i + 2]);
    switch (cls) {
      case 'green':
        green++;
        break;
      case 'darkGreen':
        green++;
        darkGreen++;
        break;
      case 'creamyYellow':
        fieldSpot++;
        creamy++;
        break;
      case 'fieldSpot':
        fieldSpot++;
        break;
      case 'other':
        break;
    }
  }

  if (total === 0) {
    return { total: 0, greenRatio: 0, darkGreenRatio: 0, fieldSpotRatio: 0, creaminess: 0 };
  }

  return {
    total,
    greenRatio: green / total,
    darkGreenRatio: darkGreen / total,
    fieldSpotRatio: fieldSpot / total,
    creaminess: fieldSpot === 0 ? 0 : creamy / fieldSpot,
  };
}
