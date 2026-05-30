/**
 * soundAnalysis.ts
 *
 * Pure, testable functions for the "thump test". When you knock a watermelon:
 *
 *  - RIPE  → a deep, muffled, hollow thud. As a melon ripens its natural
 *            frequency drops; research highlights a low band (~120-180 Hz).
 *  - UNRIPE → a clear, high, almost metallic ring (higher dominant frequency).
 *  - OVERRIPE → a dull, dead thud with heavy damping (very low energy / muddy).
 *
 * We work on a magnitude spectrum (e.g. from an AnalyserNode's frequency data)
 * and look at where the acoustic energy concentrates.
 *
 * Sources are documented in README.md.
 */

/** Lower/upper bounds (Hz) of the "ripe thud" band. */
export const RIPE_BAND_LOW = 60;
export const RIPE_BAND_HIGH = 200;

/**
 * Convert an FFT bin index to its centre frequency in Hz.
 * `binCount` is the number of magnitude bins (== fftSize / 2).
 */
export function binToFrequency(bin: number, sampleRate: number, binCount: number): number {
  return (bin * sampleRate) / (binCount * 2);
}

/**
 * Find the dominant (highest-energy) frequency in a magnitude spectrum.
 * Returns the centre frequency of the strongest bin in Hz.
 */
export function dominantFrequency(
  magnitudes: ArrayLike<number>,
  sampleRate: number,
): number {
  if (magnitudes.length === 0) return 0;
  let maxBin = 0;
  let maxVal = -Infinity;
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxVal) {
      maxVal = magnitudes[i];
      maxBin = i;
    }
  }
  return binToFrequency(maxBin, sampleRate, magnitudes.length);
}

/**
 * Fraction of total spectral energy that falls inside the ripe band.
 * A ripe melon concentrates energy low; a ringing unripe one spreads it high.
 */
export function ripeBandEnergyRatio(
  magnitudes: ArrayLike<number>,
  sampleRate: number,
  low = RIPE_BAND_LOW,
  high = RIPE_BAND_HIGH,
): number {
  let band = 0;
  let total = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    // Treat magnitudes as amplitudes; square for energy.
    const energy = magnitudes[i] * magnitudes[i];
    total += energy;
    const freq = binToFrequency(i, sampleRate, magnitudes.length);
    if (freq >= low && freq <= high) band += energy;
  }
  return total === 0 ? 0 : band / total;
}

export type ThumpVerdict = 'ripe' | 'unripe' | 'overripe' | 'unknown';

export interface ThumpResult {
  dominantHz: number;
  bandEnergyRatio: number;
  verdict: ThumpVerdict;
  /** 0-100 ripeness confidence from the sound alone. */
  score: number;
  message: string;
}

/**
 * Interpret a thump from its magnitude spectrum and overall loudness.
 *
 * @param magnitudes magnitude/amplitude per FFT bin
 * @param sampleRate audio sample rate in Hz
 * @param peakLevel  normalised peak loudness of the knock [0,1]; very quiet
 *                   inputs are treated as "no knock detected".
 */
export function analyzeThump(
  magnitudes: ArrayLike<number>,
  sampleRate: number,
  peakLevel = 1,
): ThumpResult {
  const dominantHz = dominantFrequency(magnitudes, sampleRate);
  const bandEnergyRatio = ripeBandEnergyRatio(magnitudes, sampleRate);

  if (peakLevel < 0.05) {
    return {
      dominantHz,
      bandEnergyRatio,
      verdict: 'unknown',
      score: 0,
      message: 'No clear knock detected — tap the watermelon firmly and try again.',
    };
  }

  // Overripe: almost all energy crammed into the very bottom, dead thud.
  if (dominantHz > 0 && dominantHz < RIPE_BAND_LOW && bandEnergyRatio > 0.85) {
    return {
      dominantHz,
      bandEnergyRatio,
      verdict: 'overripe',
      score: 45,
      message: 'Very dull, dead thud — this one may be overripe or mealy inside.',
    };
  }

  // Ripe: strong low-band energy and a low dominant frequency.
  if (bandEnergyRatio >= 0.5 && dominantHz <= RIPE_BAND_HIGH) {
    const score = Math.round(60 + 40 * Math.min(1, bandEnergyRatio));
    return {
      dominantHz,
      bandEnergyRatio,
      verdict: 'ripe',
      score,
      message: 'Deep, hollow thud — a great sign of a juicy, ripe melon! 🥁',
    };
  }

  // Unripe: bright, high-pitched, ringing knock.
  const score = Math.round(40 * bandEnergyRatio);
  return {
    dominantHz,
    bandEnergyRatio,
    verdict: 'unripe',
    score,
    message: 'High, ringing knock — this melon is probably under-ripe.',
  };
}
