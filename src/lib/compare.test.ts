import { describe, it, expect } from 'vitest';
import { rankMelons, bestId, rankOf, type MelonRecord } from './compare';

function rec(id: number, score: number): MelonRecord {
  return { id, score, grade: 'good', thumb: '', headline: '' };
}

const list = [rec(1, 72), rec(2, 88), rec(3, 88), rec(4, 40)];

describe('rankMelons', () => {
  it('sorts best-first', () => {
    expect(rankMelons(list).map((m) => m.id)).toEqual([2, 3, 1, 4]);
  });

  it('breaks ties by original scan order', () => {
    // melon 2 and 3 both scored 88; 2 was scanned first so it ranks above 3.
    const ranked = rankMelons(list);
    expect(ranked[0].id).toBe(2);
    expect(ranked[1].id).toBe(3);
  });

  it('does not mutate the input', () => {
    const copy = [...list];
    rankMelons(list);
    expect(list).toEqual(copy);
  });
});

describe('bestId', () => {
  it('returns the top-scoring melon id', () => {
    expect(bestId(list)).toBe(2);
  });
  it('returns null for an empty list', () => {
    expect(bestId([])).toBeNull();
  });
});

describe('rankOf', () => {
  it('reports 1-based rank and total', () => {
    expect(rankOf(list, 1)).toEqual({ rank: 3, total: 4 });
    expect(rankOf(list, 2)).toEqual({ rank: 1, total: 4 });
  });
  it('handles an unknown id', () => {
    expect(rankOf(list, 99)).toEqual({ rank: 0, total: 4 });
  });
});
