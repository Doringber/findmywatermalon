/**
 * mlDetection.ts — optional, on-device ML object localisation via TensorFlow.js
 * (COCO-SSD). It runs entirely in the browser; nothing is uploaded.
 *
 * Why a hybrid: pretrained detectors have no dedicated "watermelon" class, so
 * the model is used for robust *localisation* of the dominant foreground object
 * (it gives much cleaner boxes than a colour blob in cluttered produce bins),
 * and our HSV colour score confirms the object is actually a watermelon. If the
 * model can't load (offline, unsupported device), callers fall back to the
 * pure colour-blob detector.
 *
 * TensorFlow.js is heavy, so it is loaded with dynamic `import()` and ends up in
 * its own lazily-fetched chunk — the initial app load stays light.
 */

import type { DetectionBox } from './detection';

export interface MlCandidate {
  box: DetectionBox;
  /** Model objectness confidence [0, 1]. */
  objectScore: number;
  /** Fraction of the box that reads as watermelon colour [0, 1]. */
  melonScore: number;
  /** How centred the box is in the frame [0, 1] — favours the aimed melon. */
  centerScore?: number;
  className: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CocoModel = { detect: (img: any, maxBoxes?: number) => Promise<Array<{ bbox: number[]; class: string; score: number }>> };

let modelPromise: Promise<CocoModel> | null = null;

/** Lazily load the detector. Resolves to true once ready, false on failure. */
export async function loadMlDetector(): Promise<boolean> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      // lite_mobilenet_v2 is the smallest/fastest base — best for phones.
      return (await cocoSsd.load({ base: 'lite_mobilenet_v2' })) as unknown as CocoModel;
    })();
  }
  try {
    await modelPromise;
    return true;
  } catch {
    modelPromise = null; // allow a retry later
    return false;
  }
}

/**
 * Run object detection on a square ImageData frame. Returns boxes normalised to
 * [0, 1]. `melonScore` is left at 0 here; the caller fills it via colour.
 */
export async function detectObjects(
  frame: ImageData,
): Promise<Array<{ box: DetectionBox; objectScore: number; className: string }>> {
  if (!modelPromise) return [];
  const model = await modelPromise;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preds = await model.detect(frame as any, 10);
  const size = frame.width;
  return preds.map((p) => ({
    box: { x: p.bbox[0] / size, y: p.bbox[1] / size, w: p.bbox[2] / size, h: p.bbox[3] / size },
    objectScore: p.score,
    className: p.class,
  }));
}

/**
 * Combined score: melon colour matters most, then how centred the object is
 * (the melon the user is aiming at in a crowded bin), then model confidence.
 */
export function combinedScore(c: {
  objectScore: number;
  melonScore: number;
  centerScore?: number;
}): number {
  return c.melonScore * 0.5 + (c.centerScore ?? 0) * 0.3 + c.objectScore * 0.2;
}

/**
 * Pick the most watermelon-like detected object. Candidates below `minMelon`
 * colour coverage are rejected (so the model can't lock onto a green bag).
 */
export function chooseBestBox(candidates: MlCandidate[], minMelon = 0.35): MlCandidate | null {
  const viable = candidates.filter((c) => c.melonScore >= minMelon);
  if (!viable.length) return null;
  return viable.reduce((best, c) => (combinedScore(c) > combinedScore(best) ? c : best));
}
