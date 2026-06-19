# 🍉 AI vision Worker (optional, free)

A tiny [Cloudflare Worker](https://workers.cloudflare.com/) that grades a
watermelon photo with **Claude vision**. It exists so the app can offer an
optional "Ask AI" second opinion **without** shipping an API key to the browser.

- **Free tier:** Cloudflare Workers' free plan covers 100k requests/day.
- **Cost:** you pay Anthropic only for the vision calls you actually make
  (the model is `claude-opus-4-8`; switch to `claude-haiku-4-5` in
  `src/index.ts` to cut cost if you prefer).
- **Privacy:** the frontend only calls this when the user taps **Ask AI**, and
  only sends that one photo.

## Deploy (≈3 minutes)

```bash
cd worker
npm install
npx wrangler login                     # opens browser, one-time
npx wrangler secret put ANTHROPIC_API_KEY   # paste your Anthropic key
npx wrangler deploy
```

`wrangler deploy` prints a URL like
`https://findmywatermelon-ai.<your-subdomain>.workers.dev`.

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
