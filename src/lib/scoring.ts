/**
 * scoring.ts
 *
 * Combines the colour (vision) and sound (acoustic) signals into a single,
 * friendly verdict plus a transparent checklist of the classic watermelon
 * picking criteria. Everything here is pure and unit-tested.
 */

import type { ColorMetrics } from './colorAnalysis';
import type { ThumpResult } from './soundAnalysis';

export interface Check {
  id: string;
  label: string;
  /** 0-100 sub-score for this individual criterion. */
  score: number;
  passed: boolean;
  detail: string;
}

export type Grade = 'excellent' | 'good' | 'fair' | 'poor';

export interface WatermelonVerdict {
  /** Overall 0-100 ripeness/sweetness score. */
  score: number;
  grade: Grade;
  headline: string;
  emoji: string;
  checks: Check[];
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Score the creamy yellow field spot. Some yellow is good; creamier is better. */
export function scoreFieldSpot(m: ColorMetrics): Check {
  // A visible field spot typically covers a few percent of the visible rind.
  const coverage = clamp((m.fieldSpotRatio / 0.06) * 100); // ~6% saturates
  const creaminessBonus = m.creaminess * 100;
  const score = clamp(0.6 * coverage + 0.4 * creaminessBonus);
  const passed = m.fieldSpotRatio >= 0.01 && m.creaminess >= 0.3;
  return {
    id: 'fieldSpot',
    label: 'Creamy yellow field spot',
    score,
    passed,
    detail: passed
      ? 'Nice buttery-yellow belly — it ripened on the vine. Sweet sign!'
      : m.fieldSpotRatio < 0.01
        ? 'No clear field spot visible — turn the melon so its underside faces the camera.'
        : 'Field spot looks pale/white rather than creamy yellow — may be under-ripe.',
  };
}

/** Score the rind: deep green coverage. */
export function scoreRindColor(m: ColorMetrics): Check {
  const score = clamp((m.greenRatio / 0.5) * 100); // ~50% green fills the frame
  const passed = m.greenRatio >= 0.2;
  return {
    id: 'rind',
    label: 'Deep green & yellow rind',
    score,
    passed,
    detail: passed
      ? 'Healthy green rind detected with good colour contrast.'
      : 'Not much watermelon rind in view — fill the frame with the melon.',
  };
}

/** Score the dark stripe "webbing" / sugar spots. */
export function scoreWebbing(m: ColorMetrics): Check {
  // Dark stripes are a fraction of the green; a little webbing is a good sign.
  const relative = m.greenRatio === 0 ? 0 : m.darkGreenRatio / m.greenRatio;
  const score = clamp((relative / 0.35) * 100);
  const passed = relative >= 0.12;
  return {
    id: 'webbing',
    label: 'Dark stripes / webbing',
    score,
    passed,
    detail: passed
      ? 'Good dark-green striping — a sign of strong pollination and sweetness.'
      : 'Stripes look faint — well-defined dark stripes usually mean a sweeter melon.',
  };
}

/** Score the acoustic thump test. */
export function scoreSound(thump: ThumpResult | null): Check {
  if (!thump || thump.verdict === 'unknown') {
    return {
      id: 'sound',
      label: 'Hollow "thump" sound',
      score: 0,
      passed: false,
      detail: 'Optional: tap the melon near the mic for a deep, hollow thud.',
    };
  }
  return {
    id: 'sound',
    label: 'Hollow "thump" sound',
    score: thump.score,
    passed: thump.verdict === 'ripe',
    detail: thump.message,
  };
}

/**
 * Score the melon's shape from its bounding-box aspect ratio (width / height).
 * Per the classic guide: rounder, squatter melons ("girls") tend to be sweeter,
 * while tall, elongated ones ("boys") are more watery and less sweet.
 */
export function scoreShape(aspect: number): Check {
  const elongation = aspect > 0 && isFinite(aspect) ? Math.max(aspect, 1 / aspect) : 1;
  const score = clamp(100 - (elongation - 1) * 130);
  const passed = elongation <= 1.25;
  return {
    id: 'shape',
    label: 'Round, sweet shape',
    score,
    passed,
    detail: passed
      ? 'Nicely rounded — plump, round melons tend to be the sweetest.'
      : 'Looks elongated/oval — taller melons are often more watery and less sweet.',
  };
}

function gradeFor(score: number): { grade: Grade; headline: string; emoji: string } {
  if (score >= 80) {
    return { grade: 'excellent', headline: 'Top pick — grab this one!', emoji: '🍉✨' };
  }
  if (score >= 65) {
    return { grade: 'good', headline: 'Looks like a sweet, ripe melon.', emoji: '🍉👍' };
  }
  if (score >= 45) {
    return { grade: 'fair', headline: 'Decent, but you can probably do better.', emoji: '🤔' };
  }
  return { grade: 'poor', headline: 'Skip this one — keep looking.', emoji: '👎' };
}

/**
 * Produce the overall verdict. Sound and shape are optional; whichever signals
 * are present are weighted and re-normalised so the score always fills 0-100.
 *
 * @param shapeAspect optional bounding-box aspect ratio (width / height) of the
 *                    detected melon, used for the shape check.
 */
export function computeVerdict(
  colors: ColorMetrics,
  thump: ThumpResult | null,
  shapeAspect?: number,
): WatermelonVerdict {
  const fieldSpot = scoreFieldSpot(colors);
  const rind = scoreRindColor(colors);
  const webbing = scoreWebbing(colors);
  const sound = scoreSound(thump);

  const checks: Check[] = [fieldSpot, rind, webbing, sound];

  // Each present signal gets a raw weight; we normalise by the total so the
  // field spot and sound (the strongest sweetness signals) dominate.
  const parts: Array<{ check: Check; weight: number }> = [
    { check: fieldSpot, weight: 0.34 },
    { check: rind, weight: 0.16 },
    { check: webbing, weight: 0.12 },
  ];

  const hasSound = !!thump && thump.verdict !== 'unknown';
  if (hasSound) parts.push({ check: sound, weight: 0.3 });

  const hasShape = typeof shapeAspect === 'number' && isFinite(shapeAspect) && shapeAspect > 0;
  if (hasShape) {
    const shape = scoreShape(shapeAspect as number);
    checks.push(shape);
    parts.push({ check: shape, weight: 0.15 });
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = clamp(
    Math.round(parts.reduce((sum, p) => sum + p.check.score * p.weight, 0) / totalWeight),
  );

  const { grade, headline, emoji } = gradeFor(score);
  return { score, grade, headline, emoji, checks };
}
