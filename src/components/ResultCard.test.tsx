import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultCard } from './ResultCard';
import type { WatermelonVerdict } from '../lib/scoring';

const verdict: WatermelonVerdict = {
  score: 88,
  grade: 'excellent',
  headline: 'Top pick — grab this one!',
  emoji: '🍉✨',
  checks: [
    { id: 'fieldSpot', label: 'Creamy yellow field spot', score: 90, passed: true, detail: 'Sweet sign!' },
    { id: 'sound', label: 'Hollow "thump" sound', score: 30, passed: false, detail: 'Tap it.' },
  ],
};

describe('<ResultCard />', () => {
  it('shows the overall score and headline', () => {
    render(<ResultCard verdict={verdict} />);
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText(/Top pick/)).toBeInTheDocument();
  });

  it('renders every check with its label', () => {
    render(<ResultCard verdict={verdict} />);
    expect(screen.getByText('Creamy yellow field spot')).toBeInTheDocument();
    expect(screen.getByText('Hollow "thump" sound')).toBeInTheDocument();
  });

  it('marks passed and unpassed checks differently', () => {
    render(<ResultCard verdict={verdict} />);
    expect(screen.getByText('✅')).toBeInTheDocument(); // field spot passed
    expect(screen.getByText('⚪️')).toBeInTheDocument(); // sound not passed
  });

  it('shows a "good choice" sound banner when a ripe thump is supplied', () => {
    render(
      <ResultCard
        verdict={verdict}
        thump={{
          dominantHz: 150,
          bandEnergyRatio: 0.9,
          verdict: 'ripe',
          score: 95,
          message: 'deep thud',
        }}
      />,
    );
    expect(screen.getByText(/good choice/i)).toBeInTheDocument();
    expect(screen.getByText('150 Hz')).toBeInTheDocument();
  });

  it('omits the sound banner when no thump is supplied', () => {
    render(<ResultCard verdict={verdict} />);
    expect(screen.queryByText(/good choice/i)).not.toBeInTheDocument();
  });
});
