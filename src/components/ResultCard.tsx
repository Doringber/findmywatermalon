import type { WatermelonVerdict } from '../lib/scoring';

const gradeColors: Record<string, string> = {
  excellent: '#1a7f37',
  good: '#3fae5a',
  fair: '#e0a800',
  poor: '#d1242f',
};

export function ResultCard({ verdict }: { verdict: WatermelonVerdict }) {
  const color = gradeColors[verdict.grade];
  return (
    <section className="result-card" aria-live="polite">
      <div className="score-ring" style={{ ['--ring-color' as string]: color }}>
        <div
          className="score-ring-fill"
          style={{
            background: `conic-gradient(${color} ${verdict.score * 3.6}deg, #e8efe9 0deg)`,
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
    </section>
  );
}
