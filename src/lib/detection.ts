/**
 * detection.ts
 *
 * A lightweight, on-device "watermelon finder" — the camera equivalent of face
 * detection, but for watermelons. It scans a frame, finds the largest blob of
 * watermelon-coloured pixels (green rind / yellow field spot), and reports a
 * bounding box plus a confidence so the UI can draw a tracking box and "lock
 * on" when it is sure.
 *
 * No ML model or network needed: we build a coarse colour mask and flood-fill
 * the largest connected region. Pure and unit-tested.
 */

import { classifyPixel } from './colorAnalysis';

export interface DetectionBox {
  /** All values normalised to [0, 1] relative to the analysed image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectionResult {
  found: boolean;
  /** 0-1 confidence that a watermelon is framed. */
  confidence: number;
  /** Fraction of the image covered by the detected blob. */
  coverage: number;
  box: DetectionBox | null;
}

export interface DetectOptions {
  /** Mask grid resolution. */
  cols?: number;
  rows?: number;
  /** Minimum blob coverage to count as a detection. */
  minCoverage?: number;
  /** Confidence threshold for `found`. */
  minConfidence?: number;
}

/** True when a pixel reads as part of a watermelon (green rind or field spot). */
function isMelonColor(r: number, g: number, b: number): boolean {
  const c = classifyPixel(r, g, b);
  return c === 'green' || c === 'darkGreen' || c === 'creamyYellow' || c === 'fieldSpot';
}

/**
 * Fraction of watermelon-coloured pixels inside a normalised box region.
 * Used to confirm that an object the ML detector found is actually a melon.
 */
export function melonCoverageInBox(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  box: DetectionBox,
): number {
  const x0 = Math.max(0, Math.floor(box.x * width));
  const y0 = Math.max(0, Math.floor(box.y * height));
  const x1 = Math.min(width, Math.ceil((box.x + box.w) * width));
  const y1 = Math.min(height, Math.ceil((box.y + box.h) * height));
  if (x1 <= x0 || y1 <= y0) return 0;

  const stepX = Math.max(1, Math.floor((x1 - x0) / 24));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 24));
  let melon = 0;
  let total = 0;
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const i = (y * width + x) * 4;
      total++;
      if (isMelonColor(rgba[i], rgba[i + 1], rgba[i + 2])) melon++;
    }
  }
  return total === 0 ? 0 : melon / total;
}

/**
 * Build a coarse boolean mask: each cell is `true` when most of the pixels it
 * covers are watermelon-coloured.
 */
export function buildMask(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  cols: number,
  rows: number,
): boolean[] {
  if (rgba.length !== width * height * 4) {
    throw new Error('Pixel buffer length does not match width * height * 4.');
  }
  const mask = new Array<boolean>(cols * rows).fill(false);
  const cellW = width / cols;
  const cellH = height / rows;

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor(rx * cellW);
      const y0 = Math.floor(ry * cellH);
      const x1 = Math.min(width, Math.floor((rx + 1) * cellW));
      const y1 = Math.min(height, Math.floor((ry + 1) * cellH));

      let melon = 0;
      let total = 0;
      // Sample a sparse grid within the cell for speed.
      const stepX = Math.max(1, Math.floor((x1 - x0) / 4));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 4));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const i = (y * width + x) * 4;
          total++;
          if (isMelonColor(rgba[i], rgba[i + 1], rgba[i + 2])) melon++;
        }
      }
      mask[ry * cols + rx] = total > 0 && melon / total >= 0.5;
    }
  }
  return mask;
}

interface Component {
  size: number;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/** Find the largest 4-connected component of `true` cells in the mask. */
export function largestComponent(mask: boolean[], cols: number, rows: number): Component | null {
  const seen = new Array<boolean>(mask.length).fill(false);
  let best: Component | null = null;
  const stack: number[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;

    let size = 0;
    let minCol = cols;
    let maxCol = -1;
    let minRow = rows;
    let maxRow = -1;

    stack.length = 0;
    stack.push(start);
    seen[start] = true;

    while (stack.length) {
      const idx = stack.pop()!;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      size++;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;

      // 4-connected neighbours
      const neighbours = [
        col > 0 ? idx - 1 : -1,
        col < cols - 1 ? idx + 1 : -1,
        row > 0 ? idx - cols : -1,
        row < rows - 1 ? idx + cols : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = true;
          stack.push(n);
        }
      }
    }

    if (!best || size > best.size) {
      best = { size, minCol, maxCol, minRow, maxRow };
    }
  }
  return best;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Detect the dominant watermelon region in an RGBA image.
 */
export function detectWatermelonRegion(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  options: DetectOptions = {},
): DetectionResult {
  const { cols = 24, rows = 24, minCoverage = 0.05, minConfidence = 0.4 } = options;

  const mask = buildMask(rgba, width, height, cols, rows);
  const blob = largestComponent(mask, cols, rows);
  const cellCount = cols * rows;

  if (!blob) {
    return { found: false, confidence: 0, coverage: 0, box: null };
  }

  const coverage = blob.size / cellCount;
  const boxCols = blob.maxCol - blob.minCol + 1;
  const boxRows = blob.maxRow - blob.minRow + 1;
  // Compactness: how solidly the blob fills its bounding box (0-1).
  const compactness = blob.size / (boxCols * boxRows);

  // Confidence blends "enough of the frame is melon" with "it's a solid blob".
  const confidence = clamp01((coverage / 0.35) * 0.6 + compactness * 0.4);

  const box: DetectionBox = {
    x: blob.minCol / cols,
    y: blob.minRow / rows,
    w: boxCols / cols,
    h: boxRows / rows,
  };

  return {
    found: coverage >= minCoverage && confidence >= minConfidence,
    confidence,
    coverage,
    box,
  };
}
