/**
 * confetti.ts — a tiny, dependency-free canvas confetti burst for the moment a
 * great watermelon is found. Decorative only; respects reduced-motion.
 */

const COLORS = ['#fb3b66', '#1f8049', '#f7c948', '#ff6f8d', '#ffffff'];

export function burstConfetti(canvas: HTMLCanvasElement, durationMs = 1400): void {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const count = 110;
  const parts = Array.from({ length: count }, () => ({
    x: w / 2,
    y: h * 0.32,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -11 - 3,
    size: 5 + Math.random() * 7,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[(Math.random() * COLORS.length) | 0],
  }));

  const start = performance.now();
  const gravity = 0.26;

  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t / durationMs);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (t < durationMs) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  };
  requestAnimationFrame(frame);
}
