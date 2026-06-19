import { describe, it, expect } from 'vitest';
import { normalizeOpinion } from './aiVision';

describe('normalizeOpinion', () => {
  it('passes through a well-formed response', () => {
    const o = normalizeOpinion({
      isWatermelon: true,
      score: 84,
      verdict: 'good',
      headline: 'Looks sweet',
      reasons: ['Big creamy field spot', 'Good webbing'],
    });
    expect(o).toEqual({
      isWatermelon: true,
      score: 84,
      verdict: 'good',
      headline: 'Looks sweet',
      reasons: ['Big creamy field spot', 'Good webbing'],
    });
  });

  it('clamps and rounds the score', () => {
    expect(normalizeOpinion({ score: 140 }).score).toBe(100);
    expect(normalizeOpinion({ score: -5 }).score).toBe(0);
    expect(normalizeOpinion({ score: 71.6 }).score).toBe(72);
    expect(normalizeOpinion({ score: 'oops' }).score).toBe(0);
  });

  it('falls back to a valid verdict', () => {
    expect(normalizeOpinion({ verdict: 'amazing' }).verdict).toBe('fair');
    expect(normalizeOpinion({ verdict: 'excellent' }).verdict).toBe('excellent');
  });

  it('defaults isWatermelon to true unless explicitly false', () => {
    expect(normalizeOpinion({}).isWatermelon).toBe(true);
    expect(normalizeOpinion({ isWatermelon: false }).isWatermelon).toBe(false);
  });

  it('keeps only string reasons and caps the list', () => {
    const o = normalizeOpinion({ reasons: ['a', 2, null, 'b', 'c', 'd', 'e', 'f', 'g'] });
    expect(o.reasons).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('provides a default headline', () => {
    expect(normalizeOpinion({ headline: '   ' }).headline).toBe('AI assessment');
  });
});
