import { describe, it, expect } from 'vitest';
import { computeVerdict, scoreFieldSpot, scoreWebbing, scoreShape } from './scoring';
import type { ColorMetrics } from './colorAnalysis';
import type { ThumpResult } from './soundAnalysis';

const ripeColors: ColorMetrics = {
  total: 1000,
  greenRatio: 0.55,
  darkGreenRatio: 0.12,
  fieldSpotRatio: 0.05,
  creaminess: 0.9,
};

const unripeColors: ColorMetrics = {
  total: 1000,
  greenRatio: 0.5,
  darkGreenRatio: 0.01,
  fieldSpotRatio: 0.002,
  creaminess: 0.1,
};

const ripeThump: ThumpResult = {
  dominantHz: 150,
  bandEnergyRatio: 0.9,
  verdict: 'ripe',
  score: 95,
  message: 'deep thud',
};

describe('scoreFieldSpot', () => {
  it('passes a creamy, well-covered field spot', () => {
    const check = scoreFieldSpot(ripeColors);
    expect(check.passed).toBe(true);
    expect(check.score).toBeGreaterThan(60);
  });

  it('fails a pale, tiny field spot', () => {
    const check = scoreFieldSpot(unripeColors);
    expect(check.passed).toBe(false);
  });
});

describe('scoreWebbing', () => {
  it('rewards visible dark striping', () => {
    expect(scoreWebbing(ripeColors).passed).toBe(true);
  });
  it('penalises faint striping', () => {
    expect(scoreWebbing(unripeColors).passed).toBe(false);
  });
});

describe('scoreShape', () => {
  it('rewards a round melon (aspect ~1)', () => {
    const check = scoreShape(1);
    expect(check.passed).toBe(true);
    expect(check.score).toBe(100);
  });

  it('treats portrait and landscape elongation the same', () => {
    expect(scoreShape(1.5).score).toBeCloseTo(scoreShape(1 / 1.5).score);
  });

  it('penalises an elongated melon', () => {
    const check = scoreShape(1.8);
    expect(check.passed).toBe(false);
    expect(check.score).toBeLessThan(50);
  });
});

describe('computeVerdict', () => {
  it('adds a shape check only when an aspect ratio is given', () => {
    expect(computeVerdict(ripeColors, null).checks.find((c) => c.id === 'shape')).toBeUndefined();
    const withShape = computeVerdict(ripeColors, null, 1);
    expect(withShape.checks.find((c) => c.id === 'shape')).toBeDefined();
    expect(withShape.checks).toHaveLength(5);
  });

  it('an elongated shape drags the score below a round one', () => {
    const round = computeVerdict(ripeColors, null, 1).score;
    const oval = computeVerdict(ripeColors, null, 2).score;
    expect(oval).toBeLessThan(round);
  });

  it('grades a ripe melon highly when sound confirms it', () => {
    const v = computeVerdict(ripeColors, ripeThump);
    expect(v.score).toBeGreaterThanOrEqual(80);
    expect(v.grade).toBe('excellent');
    expect(v.checks).toHaveLength(4);
  });

  it('still works (and renormalises) without a sound sample', () => {
    const v = computeVerdict(ripeColors, null);
    expect(v.score).toBeGreaterThan(60);
    // The sound check is present but contributes 0 weight.
    const sound = v.checks.find((c) => c.id === 'sound');
    expect(sound?.score).toBe(0);
  });

  it('gives a poor grade to an unripe-looking melon', () => {
    const v = computeVerdict(unripeColors, null);
    expect(v.score).toBeLessThan(45);
    expect(v.grade).toBe('poor');
  });

  it('always returns a score within 0-100', () => {
    const v = computeVerdict(ripeColors, ripeThump);
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.score).toBeLessThanOrEqual(100);
  });
});
