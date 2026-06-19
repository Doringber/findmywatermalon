/**
 * compare.ts — pure helpers for "find the best one" Compare mode. Keeps a
 * session list of scanned melons and ranks them so the user can pick the winner
 * out of a whole bin.
 */

import type { Grade } from './scoring';

export interface MelonRecord {
  id: number;
  score: number;
  grade: Grade;
  /** JPEG data URL thumbnail of the scanned melon. */
  thumb: string;
  headline: string;
}

/** Return a copy sorted best-first (highest score wins; ties keep scan order). */
export function rankMelons(list: MelonRecord[]): MelonRecord[] {
  return list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.score - a.m.score || a.i - b.i)
    .map(({ m }) => m);
}

/** Id of the best melon so far, or null when the list is empty. */
export function bestId(list: MelonRecord[]): number | null {
  const ranked = rankMelons(list);
  return ranked.length ? ranked[0].id : null;
}

/** 1-based rank of a melon within the list, plus the total count. */
export function rankOf(list: MelonRecord[], id: number): { rank: number; total: number } {
  const ranked = rankMelons(list);
  const idx = ranked.findIndex((m) => m.id === id);
  return { rank: idx < 0 ? 0 : idx + 1, total: ranked.length };
}
