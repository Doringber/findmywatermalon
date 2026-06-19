/**
 * findmywatermelon-ai — Cloudflare Worker
 *
 * Free-tier serverless endpoint that grades a watermelon photo with Claude
 * vision. The frontend (GitHub Pages) POSTs a single JPEG; the Anthropic API
 * key stays here as a Worker secret and never reaches the browser.
 *
 * Deploy:
 *   cd worker && npm install
 *   npx wrangler secret put ANTHROPIC_API_KEY
 *   npx wrangler deploy
 */

import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

// Stable instructions — cached so repeat calls only pay ~0.1x for this prefix.
const SYSTEM_PROMPT = `You are a produce expert who grades watermelons from a single photo.
Judge ripeness and sweetness from visible cues only:
- Field spot: a large creamy/buttery-yellow patch means it ripened on the vine and is sweeter; white or pale means under-ripe.
- Webbing / sugar spots: more brown "webbing" means more pollination, which means sweeter.
- Stripes: well-defined dark-green stripes are a good sign.
- Shape: rounder, plumper melons tend to be sweeter; tall/elongated ones are more watery.
- Skin: deep, dull (not shiny) green, with no soft spots, bruises, mold, or cuts.
You cannot taste, knock, or weigh the melon — judge only what the photo shows and be honest about uncertainty.
If the image does not clearly show a watermelon, set isWatermelon to false and score 0.
Give concise, specific, friendly reasons a shopper can act on. Score 0-100 for likely sweetness/ripeness.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    isWatermelon: { type: 'boolean' },
    score: { type: 'integer' },
    verdict: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'] },
    headline: { type: 'string' },
    reasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['isWatermelon', 'score', 'verdict', 'headline', 'reasons'],
};

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function resolveOrigin(request: Request, env: Env): string {
  const allowed = env.ALLOWED_ORIGIN || '';
  const reqOrigin = request.headers.get('Origin') || '';
  // Allow the configured site and localhost dev origins.
  if (reqOrigin && (reqOrigin === allowed || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin))) {
    return reqOrigin;
  }
  return allowed || '*';
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

/** Strip a `data:image/...;base64,` prefix if present. */
function toBase64(input: unknown): string | null {
  if (typeof input !== 'string' || input.length < 32) return null;
  const comma = input.indexOf(',');
  return input.startsWith('data:') && comma !== -1 ? input.slice(comma + 1) : input;
}

/** Tolerant JSON extraction in case the model wraps output in prose/code fences. */
function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Model did not return JSON.');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = resolveOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Use POST with a JSON body { image }.' }, 405, origin);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Server is missing ANTHROPIC_API_KEY.' }, 500, origin);
    }

    let payload: { image?: unknown };
    try {
      payload = (await request.json()) as { image?: unknown };
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400, origin);
    }

    const image = toBase64(payload.image);
    if (!image) {
      return json({ error: 'Missing or invalid "image" (base64 JPEG).' }, 400, origin);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        // Structured output: guarantees the response is valid JSON for SCHEMA.
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
              { type: 'text', text: 'Grade this watermelon for sweetness and ripeness.' },
            ],
          },
        ],
        // output_config is newer than some SDK type defs; cast keeps it portable.
      } as unknown as Anthropic.MessageCreateParamsNonStreaming);

      if (response.stop_reason === 'refusal') {
        return json({ error: 'The model declined to assess this image.' }, 422, origin);
      }

      const text = response.content.find((b) => b.type === 'text');
      const parsed = extractJson(text && 'text' in text ? text.text : '');
      return json(parsed, 200, origin);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return json({ error: 'AI request failed.', detail: message }, 502, origin);
    }
  },
};
