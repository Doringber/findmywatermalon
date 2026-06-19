import { useEffect } from 'react';
import { rankMelons, type MelonRecord } from '../lib/compare';

const gradeColor: Record<string, string> = {
  excellent: '#1f8049',
  good: '#2aa15c',
  fair: '#d99b00',
  poor: '#fb3b66',
};

export function CompareSheet({
  list,
  currentId,
  onClose,
  onStartOver,
}: {
  list: MelonRecord[];
  currentId: number;
  onClose: () => void;
  onStartOver: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ranked = rankMelons(list);

  return (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Compare watermelons"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Your watermelon line-up</h3>
        <p className="guide-sub">
          {ranked.length > 1
            ? `Best of ${ranked.length} — grab the one crowned 🏆.`
            : 'Scan a few melons and the winner shows up here.'}
        </p>

        <ol className="compare-list">
          {ranked.map((m, i) => (
            <li
              key={m.id}
              className={`compare-row${m.id === currentId ? ' is-current' : ''}`}
            >
              <span className="compare-rank">{i === 0 ? '🏆' : `#${i + 1}`}</span>
              {m.thumb ? (
                <img className="compare-thumb" src={m.thumb} alt="" />
              ) : (
                <span className="compare-thumb placeholder">🍉</span>
              )}
              <div className="compare-meta">
                <strong>{m.headline}</strong>
                {m.id === currentId && <span className="compare-tag">just scanned</span>}
              </div>
              <span className="compare-score" style={{ color: gradeColor[m.grade] }}>
                {m.score}
              </span>
            </li>
          ))}
        </ol>

        <button className="btn primary" onClick={onClose} style={{ marginTop: 16 }}>
          Keep hunting 🍉
        </button>
        <button className="link-skip" onClick={onStartOver}>
          Start a fresh line-up
        </button>
      </div>
    </div>
  );
}
