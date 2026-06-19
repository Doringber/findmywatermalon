import { useCallback, useEffect, useRef, useState } from 'react';
import { startCamera, analyzeVideoFrame, recordThump, grabSquareFrame } from './lib/capture';
import { detectWatermelonRegion, type DetectionResult } from './lib/detection';
import { computeVerdict, type WatermelonVerdict } from './lib/scoring';
import type { ColorMetrics } from './lib/colorAnalysis';
import type { ThumpResult } from './lib/soundAnalysis';
import { ResultCard } from './components/ResultCard';
import { Guide } from './components/Guide';

type CameraState = 'idle' | 'starting' | 'live' | 'error';

/** Smoothing factor for the tracking box (0 = frozen, 1 = no smoothing). */
const SMOOTH = 0.35;
/** How often to run detection, in ms. */
const DETECT_INTERVAL = 120;

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [colors, setColors] = useState<ColorMetrics | null>(null);
  const [thump, setThump] = useState<ThumpResult | null>(null);
  const [verdict, setVerdict] = useState<WatermelonVerdict | null>(null);
  const [listening, setListening] = useState(false);

  const enableCamera = useCallback(async () => {
    setError(null);
    setCameraState('starting');
    try {
      const stream = await startCamera();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('live');
    } catch (e) {
      setCameraState('error');
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access and try again.'
          : 'Could not start the camera on this device.',
      );
    }
  }, []);

  // Live watermelon-finder loop: scans frames, tracks the melon, "locks on".
  useEffect(() => {
    if (cameraState !== 'live') return;
    let last = 0;
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (t - last < DETECT_INTERVAL || !videoRef.current) return;
      last = t;
      try {
        const frame = grabSquareFrame(videoRef.current, 144);
        const result = detectWatermelonRegion(frame.data, frame.size, frame.size);
        // Smooth the box so it glides instead of jittering.
        if (result.box) {
          const prev = lastBoxRef.current ?? result.box;
          const smoothed = {
            x: prev.x + (result.box.x - prev.x) * SMOOTH,
            y: prev.y + (result.box.y - prev.y) * SMOOTH,
            w: prev.w + (result.box.w - prev.w) * SMOOTH,
            h: prev.h + (result.box.h - prev.h) * SMOOTH,
          };
          lastBoxRef.current = smoothed;
          setDetection({ ...result, box: smoothed });
        } else {
          lastBoxRef.current = null;
          setDetection(result);
        }
      } catch {
        /* frame not ready yet — ignore */
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraState]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const scan = useCallback(() => {
    if (!videoRef.current) return;
    try {
      // Score the locked-on region when we have one, else the centre.
      const box = detection?.found ? detection.box : null;
      const c = analyzeVideoFrame(videoRef.current, box);
      setColors(c);
      setVerdict(computeVerdict(c, thump));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyse the frame.');
    }
  }, [thump, detection]);

  const doThump = useCallback(async () => {
    setListening(true);
    setError(null);
    try {
      const result = await recordThump();
      setThump(result);
      if (colors) setVerdict(computeVerdict(colors, result));
    } catch {
      setError('Microphone unavailable — the sound test was skipped.');
    } finally {
      setListening(false);
    }
  }, [colors]);

  const locked = !!detection?.found;
  const box = detection?.box;

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍉 Find My Watermelon</h1>
        <p>Point your camera at a watermelon — the AI finds it and scores how sweet it is.</p>
      </header>

      <main>
        <div className="stage">
          <video ref={videoRef} playsInline muted className="camera" />

          {cameraState === 'live' && box && (
            <div
              className={locked ? 'track-box locked' : 'track-box'}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
              aria-hidden
            >
              <span className="track-tag">
                {locked
                  ? `🍉 Locked on · ${Math.round((detection?.confidence ?? 0) * 100)}%`
                  : 'Searching…'}
              </span>
            </div>
          )}

          {cameraState === 'live' && (
            <div className="hint" aria-live="polite">
              {locked
                ? 'Watermelon detected — hold steady and tap Scan'
                : 'Move closer until the box locks onto a watermelon'}
            </div>
          )}

          {cameraState !== 'live' && (
            <div className="stage-overlay">
              {cameraState === 'idle' && (
                <button className="btn primary" onClick={enableCamera}>
                  📷 Open camera
                </button>
              )}
              {cameraState === 'starting' && <span className="spinner">Starting camera…</span>}
              {cameraState === 'error' && (
                <button className="btn primary" onClick={enableCamera}>
                  🔄 Retry camera
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {cameraState === 'live' && (
          <div className="controls">
            <button className="btn primary" onClick={scan} disabled={!locked}>
              {locked ? '🔍 Scan this watermelon' : '🔍 Aim at a watermelon…'}
            </button>
            <button className="btn secondary" onClick={doThump} disabled={listening}>
              {listening ? '🎙️ Listening… tap it!' : '🥁 Add thump test'}
            </button>
          </div>
        )}

        {verdict && <ResultCard verdict={verdict} />}

        <Guide />
      </main>

      <footer className="app-footer">
        <p>Runs entirely on your device — no photos or audio ever leave your phone. 🔒</p>
      </footer>
    </div>
  );
}
