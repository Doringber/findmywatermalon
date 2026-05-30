import { describe, it, expect } from 'vitest';
import {
  binToFrequency,
  dominantFrequency,
  ripeBandEnergyRatio,
  analyzeThump,
} from './soundAnalysis';

const SAMPLE_RATE = 44100;
const BIN_COUNT = 1024;

/** Bin index whose centre frequency is closest to `hz`. */
function binForHz(hz: number): number {
  return Math.round((hz * BIN_COUNT * 2) / SAMPLE_RATE);
}

/** Build a magnitude spectrum with a single dominant peak at `hz`. */
function spectrumAt(hz: number, peak = 1, floor = 0.01): number[] {
  const mags = new Array(BIN_COUNT).fill(floor);
  mags[binForHz(hz)] = peak;
  return mags;
}

describe('binToFrequency', () => {
  it('maps bin 0 to 0 Hz', () => {
    expect(binToFrequency(0, SAMPLE_RATE, BIN_COUNT)).toBe(0);
  });

  it('round-trips a target frequency within one bin width', () => {
    const hz = 150;
    const freq = binToFrequency(binForHz(hz), SAMPLE_RATE, BIN_COUNT);
    const binWidth = SAMPLE_RATE / (BIN_COUNT * 2);
    expect(Math.abs(freq - hz)).toBeLessThanOrEqual(binWidth);
  });
});

describe('dominantFrequency', () => {
  it('finds the strongest peak', () => {
    const freq = dominantFrequency(spectrumAt(150), SAMPLE_RATE);
    expect(freq).toBeGreaterThan(120);
    expect(freq).toBeLessThan(180);
  });

  it('returns 0 for an empty spectrum', () => {
    expect(dominantFrequency([], SAMPLE_RATE)).toBe(0);
  });
});

describe('ripeBandEnergyRatio', () => {
  it('is high when energy sits in the ripe band', () => {
    expect(ripeBandEnergyRatio(spectrumAt(150), SAMPLE_RATE)).toBeGreaterThan(0.9);
  });

  it('is low when energy is high-pitched (ringing/unripe)', () => {
    expect(ripeBandEnergyRatio(spectrumAt(3000), SAMPLE_RATE)).toBeLessThan(0.1);
  });
});

describe('analyzeThump', () => {
  it('flags a deep low thud as ripe', () => {
    const result = analyzeThump(spectrumAt(150), SAMPLE_RATE, 0.8);
    expect(result.verdict).toBe('ripe');
    expect(result.score).toBeGreaterThan(70);
  });

  it('flags a high ringing knock as unripe', () => {
    const result = analyzeThump(spectrumAt(3000), SAMPLE_RATE, 0.8);
    expect(result.verdict).toBe('unripe');
    expect(result.score).toBeLessThan(50);
  });

  it('returns unknown for a too-quiet input', () => {
    const result = analyzeThump(spectrumAt(150), SAMPLE_RATE, 0.01);
    expect(result.verdict).toBe('unknown');
    expect(result.score).toBe(0);
  });
});
