/**
 * aiVision.ts — optional "Ask AI" second opinion.
 *
 * Sends one watermelon photo to the Claude-vision Worker (see /worker) and
 * returns a structured verdict. This is the ONLY path in the app where an image
 * leaves the device, and it only runs when the user explicitly asks for it.
 *
 * The feature is gated on VITE_AI_ENDPOINT: with no Worker configured the app
 * stays 100% on-device and the AI button is hidden.
 */

export type AiVerdict = 'excellent' | 'good' | 'fair' | 'poor';

export interface AiOpinion {
  isWatermelon: boolean;
  /** 0-100 likely sweetness/ripeness. */
  score: number;
  verdict: AiVerdict;
  headline: string;
  reasons: string[];
}

const GRADES: AiVerdict[] = ['excellent', 'good', 'fair', 'poor'];

/** The configured Worker endpoint, or undefined when the AI feature is off. */
export function aiEndpoint(): string | undefined {
  const raw = import.meta.env.VITE_AI_ENDPOINT;
  return raw && raw.trim() ? raw.trim() : undefined;
}

export function aiEnabled(): boolean {
  return !!aiEndpoint();
}

/** Coerce an untrusted Worker response into a safe, well-formed AiOpinion. */
export function normalizeOpinion(raw: unknown): AiOpinion {
  const o = (raw ?? {}) as Record<string, unknown>;
  const score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
  const verdict = GRADES.includes(o.verdict as AiVerdict) ? (o.verdict as AiVerdict) : 'fair';
  const reasons = Array.isArray(o.reasons)
    ? o.reasons.filter((r): r is string => typeof r === 'string').slice(0, 6)
    : [];
  return {
    isWatermelon: o.isWatermelon !== false,
    score,
    verdict,
    headline:
      typeof o.headline === 'string' && o.headline.trim() ? o.headline.trim() : 'AI assessment',
    reasons,
  };
}

/** POST a JPEG data URL to the Worker and return its verdict. */
export async function getAiOpinion(imageDataUrl: string, signal?: AbortSignal): Promise<AiOpinion> {
  const endpoint = aiEndpoint();
  if (!endpoint) throw new Error('AI is not configured.');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl }),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { error?: string }).error;
    throw new Error(detail || `AI request failed (${res.status}).`);
  }
  return normalizeOpinion(data);
}
