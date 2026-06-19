/**
 * findmywatermelon-ai — Cloudflare Worker
 *
 * Free-tier serverless endpoint that grades a watermelon photo with a vision
 * LLM. The frontend (GitHub Pages) POSTs a single JPEG; the API key stays here
 * as a Worker secret and never reaches the browser.
 *
 * Two providers, switchable with the AI_PROVIDER var (or inferred from whichever
 * key you set):
 *   - "gemini"    → Google Gemini (FREE tier). Needs GEMINI_API_KEY.
 *   - "anthropic" → Claude (paid, top quality). Needs ANTHROPIC_API_KEY.
 *
 * Both return the SAME JSON shape, so the app doesn't care which you pick.
 *
 * Deploy:
 *   cd worker && npm install
 *   npx wrangler secret put GEMINI_API_KEY      # free key from aistudio.google.com
 *   #   ...or ANTHROPIC_API_KEY for Claude
 *   npx wrangler deploy
 */

import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  /** "gemini" | "anthropic". Optional — inferred from whichever key is set. */
  AI_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
}

// Stable instructions, shared across providers.
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

const USER_PROMPT = 'Grade this watermelon for sweetness and ripeness.';

class RefusalError extends Error {}

/* ----------------------------- helpers ----------------------------- */

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
  if (
    reqOrigin &&
    (reqOrigin === allowed || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin))
  ) {
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

/** Tolerant JSON extraction in case a model wraps output in prose/code fences. */
function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error('Model did not return JSON.');
  }
}

function pickProvider(env: Env): 'gemini' | 'anthropic' {
  const explicit = (env.AI_PROVIDER || '').toLowerCase();
  if (explicit === 'gemini' || explicit === 'anthropic') return explicit;
  if (env.GEMINI_API_KEY) return 'gemini';
  return 'anthropic';
}

/* --------------------------- Gemini (free) -------------------------- */

async function gradeWithGemini(env: Env, image: string): Promise<unknown> {
  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: image } },
          { text: USER_PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          isWatermelon: { type: 'BOOLEAN' },
          score: { type: 'INTEGER' },
          verdict: { type: 'STRING', enum: ['excellent', 'good', 'fair', 'poor'] },
          headline: { type: 'STRING' },
          reasons: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['isWatermelon', 'score', 'verdict', 'headline', 'reasons'],
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) throw new RefusalError(data.promptFeedback.blockReason);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new RefusalError('No content returned.');
  return extractJson(text);
}

/* ------------------------- Anthropic (paid) ------------------------- */

const ANTHROPIC_SCHEMA = {
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

async function gradeWithAnthropic(env: Env, image: string): Promise<unknown> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: ANTHROPIC_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === 'refusal') throw new RefusalError('Model declined.');
  const block = response.content.find((b) => b.type === 'text');
  return extractJson(block && 'text' in block ? block.text : '');
}

/* ------------------------------ handler ----------------------------- */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = resolveOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Use POST with a JSON body { image }.' }, 405, origin);
    }

    const provider = pickProvider(env);
    if (provider === 'gemini' && !env.GEMINI_API_KEY) {
      return json({ error: 'Server is missing GEMINI_API_KEY.' }, 500, origin);
    }
    if (provider === 'anthropic' && !env.ANTHROPIC_API_KEY) {
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

    try {
      const result =
        provider === 'gemini'
          ? await gradeWithGemini(env, image)
          : await gradeWithAnthropic(env, image);
      return json(result, 200, origin);
    } catch (e) {
      if (e instanceof RefusalError) {
        return json({ error: 'The model declined to assess this image.' }, 422, origin);
      }
      const message = e instanceof Error ? e.message : 'Unknown error';
      return json({ error: 'AI request failed.', detail: message }, 502, origin);
    }
  },
};
