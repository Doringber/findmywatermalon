import type { WatermelonVerdict } from '../lib/scoring';
import type { ThumpResult } from '../lib/soundAnalysis';

const gradeColors: Record<string, string> = {
  excellent: '#1f8049', // rind green
  good: '#2aa15c',
  fair: '#d99b00', // field-spot yellow, darkened for contrast
  poor: '#fb3b66', // flesh pink
};

const soundBanner: Record<string, { cls: string; text: string }> = {
  ripe: { cls: 'good', text: '✅ Sounds ripe — good choice!' },
  unripe: { cls: 'bad', text: '❌ Sounds under-ripe — try another' },
  overripe: { cls: 'warn', text: '⚠️ Sounds overripe — try another' },
};

export function ResultCard({
  verdict,
  thump,
}: {
  verdict: WatermelonVerdict;
  thump?: ThumpResult | null;
}) {
  const color = gradeColors[verdict.grade];
  const banner = thump && thump.verdict !== 'unknown' ? soundBanner[thump.verdict] : null;
  return (
    <section className="result-card" aria-live="polite">
      {banner && (
        <div className={`sound-banner ${banner.cls}`}>
          <span className="sound-banner-text">🔊 {banner.text}</span>
          <span className="sound-banner-hz">{Math.round(thump!.dominantHz)} Hz</span>
        </div>
      )}
      <div className="score-ring" style={{ ['--ring-color' as string]: color }}>
        <div
          className="score-ring-fill"
          style={{
            background: `conic-gradient(${color} ${verdict.score * 3.6}deg, #f0e3e6 0deg)`,
          }}
        >
          <div className="score-ring-inner">
            <span className="score-number">{verdict.score}</span>
            <span className="score-max">/100</span>
          </div>
        </div>
      </div>

      <h2 className="headline" style={{ color }}>
        {verdict.emoji} {verdict.headline}
      </h2>

      <div className="card">
        <ul className="checklist">
          {verdict.checks.map((c) => (
            <li key={c.id} className={c.passed ? 'check pass' : 'check'}>
              <span className="check-icon" aria-hidden>
                {c.passed ? '✅' : '⚪️'}
              </span>
              <div className="check-body">
                <div className="check-head">
                  <span className="check-label">{c.label}</span>
                  <span className="check-score">{Math.round(c.score)}</span>
                </div>
                <div className="check-bar">
                  <div
                    className="check-bar-fill"
                    style={{ width: `${c.score}%`, background: color }}
                  />
                </div>
                <p className="check-detail">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
