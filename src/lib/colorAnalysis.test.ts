import { describe, it, expect } from 'vitest';
import { rgbToHsv, classifyPixel, analyzeColors } from './colorAnalysis';

/** Build an RGBA buffer by repeating a single colour `count` times. */
function fill(count: number, [r, g, b]: [number, number, number], a = 255): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(r, g, b, a);
  return out;
}

describe('rgbToHsv', () => {
  it('converts pure red', () => {
    const { h, s, v } = rgbToHsv(255, 0, 0);
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });

  it('converts pure green to hue 120', () => {
    expect(rgbToHsv(0, 255, 0).h).toBeCloseTo(120);
  });

  it('treats black as zero saturation/value', () => {
    const { s, v } = rgbToHsv(0, 0, 0);
    expect(s).toBe(0);
    expect(v).toBe(0);
  });
});

describe('classifyPixel', () => {
  it('classifies a creamy yellow field spot', () => {
    expect(classifyPixel(220, 200, 90)).toBe('creamyYellow');
  });

  it('classifies a bright green rind', () => {
    expect(classifyPixel(60, 180, 70)).toBe('green');
  });

  it('classifies a dark green stripe', () => {
    expect(classifyPixel(20, 70, 25)).toBe('darkGreen');
  });

  it('classifies unrelated colours as other', () => {
    expect(classifyPixel(120, 120, 120)).toBe('other'); // grey
    expect(classifyPixel(200, 30, 30)).toBe('other'); // red
  });
});

describe('analyzeColors', () => {
  it('throws on a non-RGBA buffer', () => {
    expect(() => analyzeColors([1, 2, 3])).toThrow();
  });

  it('reports a high green ratio for a green image', () => {
    const m = analyzeColors(fill(100, [60, 180, 70]));
    expect(m.total).toBe(100);
    expect(m.greenRatio).toBeCloseTo(1);
    expect(m.fieldSpotRatio).toBe(0);
  });

  it('measures field spot coverage and creaminess', () => {
    // 90 green + 10 creamy yellow pixels
    const buf = [...fill(90, [60, 180, 70]), ...fill(10, [220, 200, 90])];
    const m = analyzeColors(buf);
    expect(m.fieldSpotRatio).toBeCloseTo(0.1);
    expect(m.creaminess).toBeCloseTo(1); // all yellow is the creamy kind
  });

  it('skips fully transparent pixels', () => {
    const buf = fill(10, [60, 180, 70], 0); // alpha 0
    const m = analyzeColors(buf);
    expect(m.total).toBe(0);
    expect(m.greenRatio).toBe(0);
  });

  it('respects the subsampling step', () => {
    const m = analyzeColors(fill(100, [60, 180, 70]), 10);
    expect(m.total).toBe(10);
  });
});
