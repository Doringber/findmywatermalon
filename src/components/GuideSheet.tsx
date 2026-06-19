import { useEffect } from 'react';

const TIPS = [
  {
    icon: '🟡',
    title: 'Creamy yellow field spot',
    body: 'The patch where it sat on the ground should be big and buttery-yellow. White or pale = picked too early.',
  },
  {
    icon: '🥁',
    title: 'Deep, hollow thump',
    body: 'Knock it with your knuckles. A ripe melon answers with a deep, hollow thud; an unripe one rings high and tight.',
  },
  {
    icon: '🌿',
    title: 'Dry, curly tail',
    body: 'A brown, dried-out stem (tail) means it ripened fully on the vine. A green stem means it was picked early.',
  },
  {
    icon: '🦓',
    title: 'Dark stripes & webbing',
    body: 'Well-defined dark-green stripes and rough "sugar" webbing point to good pollination and extra sweetness.',
  },
  {
    icon: '⚪️',
    title: 'Round, sweet shape',
    body: 'Plump, round melons tend to be sweeter; tall, elongated ones are usually more watery. The app reads the shape of the melon it locks onto.',
  },
  {
    icon: '⚖️',
    title: 'Heavy for its size',
    body: 'Pick two of the same size — the heavier one holds more water and is usually juicier.',
  },
];

export function GuideSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="How to pick a watermelon"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>What makes a great watermelon</h3>
        <p className="guide-sub">
          The same signals greengrocers swear by — the app scores them for you automatically.
        </p>
        <ul className="guide-list">
          {TIPS.map((t) => (
            <li key={t.title}>
              <span className="guide-icon" aria-hidden>
                {t.icon}
              </span>
              <div>
                <strong>{t.title}</strong>
                <p>{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn ghost" onClick={onClose} style={{ marginTop: 18 }}>
          Got it
        </button>
      </div>
    </div>
  );
}
