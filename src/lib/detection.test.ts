import { describe, it, expect } from 'vitest';
import {
  buildMask,
  largestComponent,
  detectWatermelonRegion,
  melonCoverageInBox,
} from './detection';

/**
 * Build a width*height RGBA image where a centred rectangle is watermelon-green
 * and the rest is grey background.
 */
function imageWithGreenRect(
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inRect =
        x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      if (inRect) {
        data[i] = 60;
        data[i + 1] = 180;
        data[i + 2] = 70; // green
      } else {
        data[i] = 120;
        data[i + 1] = 120;
        data[i + 2] = 120; // grey
      }
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('buildMask', () => {
  it('throws when the buffer size mismatches the dimensions', () => {
    expect(() => buildMask(new Uint8ClampedArray(10), 4, 4, 2, 2)).toThrow();
  });

  it('marks cells over the green region true and background false', () => {
    const w = 40;
    const h = 40;
    const data = imageWithGreenRect(w, h, { x: 0, y: 0, w: 20, h: 40 }); // left half green
    const mask = buildMask(data, w, h, 4, 4);
    // Left two columns should be green, right two grey.
    expect(mask[0]).toBe(true); // top-left
    expect(mask[3]).toBe(false); // top-right
  });
});

describe('largestComponent', () => {
  it('returns null for an all-false mask', () => {
    expect(largestComponent(new Array(9).fill(false), 3, 3)).toBeNull();
  });

  it('finds the bounding box of a connected blob', () => {
    // 3x3 grid, middle column true
    const mask = [false, true, false, false, true, false, false, true, false];
    const comp = largestComponent(mask, 3, 3);
    expect(comp).not.toBeNull();
    expect(comp!.size).toBe(3);
    expect(comp!.minCol).toBe(1);
    expect(comp!.maxCol).toBe(1);
    expect(comp!.minRow).toBe(0);
    expect(comp!.maxRow).toBe(2);
  });

  it('prefers the larger of two separate blobs', () => {
    // left single cell, right 2x2 block in a 4x2 grid
    const mask = [true, false, true, true, false, false, true, true];
    const comp = largestComponent(mask, 4, 2);
    expect(comp!.size).toBe(4);
    expect(comp!.minCol).toBe(2);
  });
});

describe('detectWatermelonRegion', () => {
  it('reports not found for a frame with no melon colours', () => {
    const w = 32;
    const h = 32;
    const grey = new Uint8ClampedArray(w * h * 4).fill(120);
    for (let i = 3; i < grey.length; i += 4) grey[i] = 255;
    const result = detectWatermelonRegion(grey, w, h);
    expect(result.found).toBe(false);
    expect(result.coverage).toBe(0);
    expect(result.box).toBeNull();
  });

  it('detects and boxes a large centred melon', () => {
    const w = 48;
    const h = 48;
    // A big centred green square (covers ~44% of the frame).
    const data = imageWithGreenRect(w, h, { x: 8, y: 8, w: 32, h: 32 });
    const result = detectWatermelonRegion(data, w, h);
    expect(result.found).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.box).not.toBeNull();
    // Box should sit roughly around the centre, not the full frame.
    expect(result.box!.x).toBeGreaterThan(0.05);
    expect(result.box!.x).toBeLessThan(0.4);
    expect(result.box!.w).toBeGreaterThan(0.4);
  });

  it('measures melon colour coverage inside a box', () => {
    const w = 40;
    const h = 40;
    // Left half green, right half grey.
    const data = imageWithGreenRect(w, h, { x: 0, y: 0, w: 20, h: 40 });
    // A box over the left (green) half should read ~fully melon.
    expect(melonCoverageInBox(data, w, h, { x: 0, y: 0, w: 0.5, h: 1 })).toBeGreaterThan(0.9);
    // A box over the right (grey) half should read ~no melon.
    expect(melonCoverageInBox(data, w, h, { x: 0.5, y: 0, w: 0.5, h: 1 })).toBeLessThan(0.1);
  });

  it('normalises the box within [0, 1]', () => {
    const w = 48;
    const h = 48;
    const data = imageWithGreenRect(w, h, { x: 8, y: 8, w: 32, h: 32 });
    const { box } = detectWatermelonRegion(data, w, h);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.w).toBeLessThanOrEqual(1.0001);
    expect(box!.y + box!.h).toBeLessThanOrEqual(1.0001);
  });
});
