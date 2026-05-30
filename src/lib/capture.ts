/**
 * capture.ts — thin browser glue around the camera & microphone.
 *
 * These helpers touch live device APIs, so they are intentionally tiny and kept
 * out of the unit-tested pure logic (colorAnalysis / soundAnalysis / scoring).
 */

import { analyzeColors, type ColorMetrics } from './colorAnalysis';
import { analyzeThump, type ThumpResult } from './soundAnalysis';

/** Grab the rear camera where available. */
export async function startCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    audio: false,
  });
}

/**
 * Draw the current video frame to an offscreen canvas and analyse its colours.
 * We sample a centred square (the "reticle") so the background matters less.
 */
export function analyzeVideoFrame(video: HTMLVideoElement): ColorMetrics {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('Camera frame not ready yet.');

  const side = Math.floor(Math.min(w, h) * 0.7);
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
  const { data } = ctx.getImageData(0, 0, side, side);
  // Subsample for speed: every 4th pixel is plenty for colour ratios.
  return analyzeColors(data, 4);
}

/**
 * Listen on the microphone for a short window, capture the loudest moment's
 * spectrum (the knock), and interpret it. Resolves after `durationMs`.
 */
export async function recordThump(durationMs = 1500): Promise<ThumpResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const bins = analyser.frequencyBinCount;
  const freqData = new Float32Array(bins);
  const timeData = new Float32Array(analyser.fftSize);

  let loudestPeak = 0;
  let loudestSpectrum: number[] = new Array(bins).fill(0);

  return new Promise<ThumpResult>((resolve) => {
    const start = performance.now();
    const tick = () => {
      analyser.getFloatTimeDomainData(timeData);
      let peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        peak = Math.max(peak, Math.abs(timeData[i]));
      }
      if (peak > loudestPeak) {
        loudestPeak = peak;
        analyser.getFloatFrequencyData(freqData); // dBFS
        // Convert dB to linear magnitude for our analysis.
        loudestSpectrum = Array.from(freqData, (db) => Math.pow(10, db / 20));
      }
      if (performance.now() - start < durationMs) {
        requestAnimationFrame(tick);
      } else {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        resolve(analyzeThump(loudestSpectrum, audioCtx.sampleRate, loudestPeak));
      }
    };
    requestAnimationFrame(tick);
  });
}
