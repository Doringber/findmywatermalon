# 🍉 Find My Watermelon

A simple, mobile-friendly **AI watermelon picker**. Open your camera, point it at
a watermelon, and the app scores how likely it is to be **sweet, ripe, and
crunchy** — using the same signals experienced shoppers rely on, judged
automatically.

Everything runs **100% on your device** in the browser. No photos or audio are
ever uploaded.

## 🚀 Live demo

**<https://doringber.github.io/findmywatermalon/>**

Open it on your phone for the full camera + thump experience. The demo is built
and deployed automatically by GitHub Actions on every push (see
`.github/workflows/deploy.yml`). GitHub Pages serves it over HTTPS, which is
required for camera/microphone access.

> First-time setup: in the repo's **Settings → Pages**, set **Source** to
> **GitHub Actions**. The workflow handles the rest.

## What it checks

| Signal | What the AI looks for | Why it matters |
| --- | --- | --- |
| 🟡 **Field spot** | A big, creamy/buttery **yellow** patch | Ripened on the vine → sweeter. White/pale = picked early |
| 🟢 **Rind colour** | Deep, dull **green** filling the frame | Healthy, mature rind |
| 🦓 **Stripes / webbing** | Well-defined **dark-green** striping | Good pollination → more sugar |
| ⚪️ **Shape** | How **round vs. elongated** the locked-on melon is | Round melons tend to be sweeter; tall ones are more watery |
| 🥁 **Thump sound** | A deep, **hollow low-frequency** thud (~120–180 Hz) | Ripe melons resonate low; unripe ones ring high. The app gives an explicit ✅/❌ "good choice" call |
| 🌿 **Dry tail** | (Guide tip) A brown, dried stem | Fully vine-ripened |

The camera analyses colour from a centred reticle; the optional **thump test**
listens through the microphone and finds the dominant frequency of your knock.

## How it works

- **Vision** — `src/lib/colorAnalysis.ts` converts pixels to HSV and classifies
  them into green rind, dark stripes, and creamy yellow field-spot buckets.
- **Sound** — `src/lib/soundAnalysis.ts` takes an FFT magnitude spectrum and
  measures how much energy sits in the ripe low-frequency band.
- **Scoring** — `src/lib/scoring.ts` blends the signals into a 0–100 score and a
  transparent, weighted checklist.

All three modules are **pure functions** with full unit-test coverage, so the
"AI" logic is verifiable without a camera.

## Run it

```bash
npm install
npm run dev        # open the printed URL on your phone (same Wi-Fi) or desktop
```

> 📷 Browsers only allow the camera/microphone on `https://` or `localhost`.
> On a phone, use `npm run dev -- --host` and a tunnel (e.g. ngrok) for HTTPS,
> or run `npm run build && npm run preview` behind HTTPS.

## Test

```bash
npm test           # run all unit + component tests once
npm run test:watch # watch mode
npm run lint       # TypeScript type-check
```

## Tech

Vite · React · TypeScript · Vitest · Web `getUserMedia` + Web Audio API. No
backend, no API keys.

## Research sources

Picking criteria (field spot, stripes, two-finger rule, weight):
- Eagle Eye Produce — <https://www.eagleeyeproduce.com/perfectwatermelon/>
- Texas A&M AgriLife — <https://agrilifetoday.tamu.edu/2025/06/26/three-tips-to-pick-out-a-sweet-watermelon/>
- The Kitchn (two-finger rule) — <https://www.thekitchn.com/watermelon-two-finger-rule-review-2025-23738225>

Acoustic / thump research (natural frequency drops as the melon ripens; ~129–172 Hz band):
- Brüel & Kjær — <https://www.bksv.com/pt/knowledge/blog/perspectives/ripe-watermelon>
- Acoustics First — <https://acousticsfirst.info/2025/07/03/dont-knock-the-knock-acoustics-and-the-pursuit-of-the-perfect-watermelon/>
- "A Study Sound Absorption for Ripeness… of Watermelon" (ResearchGate)

Visual picking guide (field spot, webbing, shape, size, tail, sound) referenced for the in-app criteria:
- r/coolguides "How to pick the right watermelon" — <https://www.reddit.com/r/coolguides/comments/f6trfi/how_to_pick_the_right_watermelon/>
- Recipes Made Easy (Facebook) — <https://www.facebook.com/groups/recipesmadeeasy/posts/4453002224985801/>
- Watermelon Board — <https://www.watermelon.org/the-slice/how-to-choose-a-watermelon/>

## Note on accuracy

This is a fun, educational aid, not a lab instrument. The visual heuristics
depend on lighting and how much of the melon fills the frame, and the thump test
depends on your phone's mic. Use it alongside your own eyes and hands. 🍉
