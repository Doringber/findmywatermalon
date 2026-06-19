# 🍉 AI vision Worker (optional)

A tiny [Cloudflare Worker](https://workers.cloudflare.com/) that grades a
watermelon photo with a **vision LLM**. It exists so the app can offer an
optional "Ask AI" second opinion **without** shipping an API key to the browser.

It supports two providers — pick one:

| Provider | Cost | Key | Quality |
| --- | --- | --- | --- |
| **Gemini** (`gemini-2.0-flash`) | **Free tier** | Free from [aistudio.google.com](https://aistudio.google.com/apikey) | Great |
| **Claude** (`claude-opus-4-8`) | Paid | [console.anthropic.com](https://console.anthropic.com) | Best |

Both return the **same JSON**, so the app doesn't care which you use. Cloudflare
Workers' free plan covers 100k requests/day either way.

## Deploy the FREE (Gemini) version (≈3 min)

```bash
cd worker
npm install
npx wrangler login                          # opens browser, one-time
npx wrangler secret put GEMINI_API_KEY      # paste your free Google AI Studio key
npx wrangler deploy
```

`wrangler deploy` prints a URL like
`https://findmywatermelon-ai.<your-subdomain>.workers.dev`.

> Prefer Claude instead? Run `npx wrangler secret put ANTHROPIC_API_KEY` (and
> nothing else) — the Worker auto-detects the provider from whichever key is
> set. To be explicit, uncomment `AI_PROVIDER` in `wrangler.toml`.

## Wire it to the app

Set that URL as `VITE_AI_ENDPOINT` when building the frontend. The "Ask AI"
button only appears when this is set, so the default build stays 100% on-device.

- Local: create `.env.local` in the repo root with
  `VITE_AI_ENDPOINT=https://findmywatermelon-ai.<you>.workers.dev`
- GitHub Pages: add it to the `Build` step env in
  `.github/workflows/deploy.yml`, or store it as a repo **Variable** and
  reference it there.

## Configure CORS

`wrangler.toml` sets `ALLOWED_ORIGIN` to `https://doringber.github.io`. Change it
if you serve the app from a different origin (localhost is always allowed for dev).

## Other free options

Want a different free model? The provider functions in `src/index.ts` are small
and isolated — swapping in **Groq** (free Llama vision), **OpenRouter** (`:free`
models), or **Cloudflare Workers AI** (`@cf/meta/llama-3.2-11b-vision-instruct`,
no external key) is a matter of adding one `gradeWith…` function that returns the
same JSON shape. Ask and I'll wire one up.
