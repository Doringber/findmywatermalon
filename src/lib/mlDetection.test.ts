import { describe, it, expect } from 'vitest';
import { combinedScore, chooseBestBox, type MlCandidate } from './mlDetection';

const box = { x: 0, y: 0, w: 0.5, h: 0.5 };

function cand(objectScore: number, melonScore: number, className = 'sports ball'): MlCandidate {
  return { box, objectScore, melonScore, className };
}

describe('combinedScore', () => {
  it('weights melon colour above raw model confidence', () => {
    const melonHeavy = combinedScore({ objectScore: 0.2, melonScore: 0.9 });
    const objectHeavy = combinedScore({ objectScore: 0.9, melonScore: 0.2 });
    expect(melonHeavy).toBeGreaterThan(objectHeavy);
  });
});

describe('chooseBestBox', () => {
  it('returns null when nothing meets the colour threshold', () => {
    expect(chooseBestBox([cand(0.99, 0.1), cand(0.8, 0.2)])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(chooseBestBox([])).toBeNull();
  });

  it('picks the most watermelon-like viable candidate', () => {
    const best = chooseBestBox([cand(0.9, 0.4), cand(0.5, 0.95), cand(0.99, 0.2)]);
    expect(best).not.toBeNull();
    expect(best!.melonScore).toBe(0.95);
  });

  it('respects a custom minimum colour threshold', () => {
    expect(chooseBestBox([cand(0.9, 0.5)], 0.6)).toBeNull();
    expect(chooseBestBox([cand(0.9, 0.5)], 0.4)).not.toBeNull();
  });
});
