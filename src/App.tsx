import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startCamera,
  analyzeVideoFrame,
  recordThump,
  grabSquareFrame,
  captureThumbnail,
} from './lib/capture';
import {
  detectWatermelonRegion,
  melonCoverageInBox,
  type DetectionResult,
  type DetectionBox,
} from './lib/detection';
import { loadMlDetector, detectObjects, chooseBestBox, combinedScore } from './lib/mlDetection';
import { computeVerdict, type WatermelonVerdict } from './lib/scoring';
import type { ColorMetrics } from './lib/colorAnalysis';
import type { ThumpResult } from './lib/soundAnalysis';
import { Stepper, type Step } from './components/Stepper';
import { StartScreen, LookScreen, ListenScreen, ResultScreen } from './components/screens';
import { GuideSheet } from './components/GuideSheet';

type CameraState = 'idle' | 'starting' | 'live' | 'error';
export type MlState = 'off' | 'loading' | 'on';

const SMOOTH = 0.35; // tracking-box smoothing (0 = frozen, 1 = none)
const DETECT_INTERVAL = 120; // colour-tracker cadence (ms)
const ML_INTERVAL = 450; // ML detection cadence (ms)
const ML_FRESH = 1000; // how long an ML pick stays valid (ms)
const LOCK_HOLD = 900; // hold-to-auto-capture duration (ms)

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastBoxRef = useRef<DetectionBox | null>(null);
  const mlPickRef = useRef<{ box: DetectionBox; score: number; t: number } | null>(null);
  const lockStartRef = useRef<number | null>(null);
  const capturedGuardRef = useRef(false);

  const [step, setStep] = useState<Step>('start');
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [mlState, setMlState] = useState<MlState>('off');
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [colors, setColors] = useState<ColorMetrics | null>(null);
  const [shape, setShape] = useState<number | undefined>(undefined);
  const [thump, setThump] = useState<ThumpResult | null>(null);
  const [verdict, setVerdict] = useState<WatermelonVerdict | null>(null);
  const [thumb, setThumb] = useState('');
  const [listening, setListening] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

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
          ? 'Camera access was blocked. Allow the camera in your browser, then try again.'
          : 'Could not start the camera on this device.',
      );
    }
  }, []);

  // Capture the locked-on melon, then advance to the sound step.
  const capture = useCallback(() => {
    if (!videoRef.current || capturedGuardRef.current) return;
    capturedGuardRef.current = true;
    try {
      const box = detection?.found ? detection.box : null;
      const aspect = box && box.h > 0 ? box.w / box.h : undefined;
      const c = analyzeVideoFrame(videoRef.current, box);
      setColors(c);
      setShape(aspect);
      setThumb(captureThumbnail(videoRef.current, box));
      setVerdict(computeVerdict(c, null, aspect));
      stopCamera();
      setCameraState('idle');
      setDetection(null);
      setHoldProgress(0);
      lastBoxRef.current = null;
      mlPickRef.current = null;
      setStep('listen');
    } catch (e) {
      capturedGuardRef.current = false;
      setError(e instanceof Error ? e.message : 'Could not read that frame — try again.');
    }
  }, [detection, stopCamera]);

  // Keep the detection loop calling the freshest capture without re-subscribing.
  const captureRef = useRef(capture);
  captureRef.current = capture;

  // Turn the camera on when we enter the Look step.
  useEffect(() => {
    if (step === 'look' && cameraState === 'idle') void enableCamera();
  }, [step, cameraState, enableCamera]);

  // Load the on-device ML detector and poll it for object boxes while looking.
  useEffect(() => {
    if (step !== 'look') return;
    let cancelled = false;
    let timer: number | undefined;
    let busy = false;

    setMlState((s) => (s === 'on' ? 'on' : 'loading'));
    loadMlDetector().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setMlState('off');
        return;
      }
      setMlState('on');
      const run = async () => {
        if (cancelled) return;
        if (!busy && videoRef.current && cameraState === 'live') {
          busy = true;
          try {
            const frame = grabSquareFrame(videoRef.current, 224);
            const img = new ImageData(new Uint8ClampedArray(frame.data), frame.size, frame.size);
            const objs = await detectObjects(img);
            const cands = objs.map((o) => ({
              ...o,
              melonScore: melonCoverageInBox(frame.data, frame.size, frame.size, o.box),
            }));
            const best = chooseBestBox(cands);
            mlPickRef.current = best
              ? { box: best.box, score: combinedScore(best), t: performance.now() }
              : null;
          } catch {
            mlPickRef.current = null;
          } finally {
            busy = false;
          }
        }
        timer = window.setTimeout(run, ML_INTERVAL);
      };
      void run();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      mlPickRef.current = null;
    };
  }, [step, cameraState]);

  // Live colour tracker (fast). Merges the latest ML pick and handles
  // hold-to-auto-capture once a lock is held steady.
  useEffect(() => {
    if (step !== 'look' || cameraState !== 'live') return;
    let last = 0;
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (t - last < DETECT_INTERVAL || !videoRef.current) return;
      last = t;
      try {
        const frame = grabSquareFrame(videoRef.current, 144);
        const colorRes = detectWatermelonRegion(frame.data, frame.size, frame.size);

        const now = performance.now();
        const ml = mlPickRef.current;
        const mlFresh = !!ml && now - ml.t < ML_FRESH;
        const targetBox = mlFresh ? ml!.box : colorRes.box;
        const found = mlFresh ? true : colorRes.found;
        const confidence = mlFresh ? Math.max(colorRes.confidence, ml!.score) : colorRes.confidence;

        if (targetBox) {
          const prev = lastBoxRef.current ?? targetBox;
          const smoothed = {
            x: prev.x + (targetBox.x - prev.x) * SMOOTH,
            y: prev.y + (targetBox.y - prev.y) * SMOOTH,
            w: prev.w + (targetBox.w - prev.w) * SMOOTH,
            h: prev.h + (targetBox.h - prev.h) * SMOOTH,
          };
          lastBoxRef.current = smoothed;
          setDetection({ found, confidence, coverage: colorRes.coverage, box: smoothed });
        } else {
          lastBoxRef.current = null;
          setDetection({ found: false, confidence: 0, coverage: 0, box: null });
        }

        // Hold-to-capture: a steady lock for LOCK_HOLD ms snaps automatically.
        if (found) {
          if (lockStartRef.current == null) lockStartRef.current = now;
          const held = now - lockStartRef.current;
          setHoldProgress(Math.min(1, held / LOCK_HOLD));
          if (held >= LOCK_HOLD) captureRef.current();
        } else {
          lockStartRef.current = null;
          setHoldProgress(0);
        }
      } catch {
        /* frame not ready — ignore */
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, cameraState]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const start = useCallback(() => {
    setError(null);
    capturedGuardRef.current = false;
    lockStartRef.current = null;
    setStep('look');
  }, []);

  const doThump = useCallback(async () => {
    setListening(true);
    setError(null);
    try {
      const result = await recordThump();
      setThump(result);
      if (colors) setVerdict(computeVerdict(colors, result, shape));
      setStep('result');
    } catch {
      setError('Microphone unavailable — skipping the sound test.');
      setStep('result');
    } finally {
      setListening(false);
    }
  }, [colors, shape]);

  const skipSound = useCallback(() => {
    setThump(null);
    if (colors) setVerdict(computeVerdict(colors, null, shape));
    setStep('result');
  }, [colors, shape]);

  const restart = useCallback(() => {
    stopCamera();
    setCameraState('idle');
    setDetection(null);
    setHoldProgress(0);
    setColors(null);
    setShape(undefined);
    setThump(null);
    setVerdict(null);
    setThumb('');
    setError(null);
    lastBoxRef.current = null;
    mlPickRef.current = null;
    lockStartRef.current = null;
    capturedGuardRef.current = false;
    setStep('start');
  }, [stopCamera]);

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">🍉 Find My Watermelon</span>
        <Stepper step={step} />
        <button
          className="icon-btn"
          onClick={() => setGuideOpen(true)}
          aria-label="How to pick a watermelon"
        >
          ?
        </button>
      </div>

      {step === 'start' && <StartScreen onStart={start} />}

      {step === 'look' && (
        <LookScreen
          videoRef={videoRef}
          cameraState={cameraState}
          mlState={mlState}
          detection={detection}
          holdProgress={holdProgress}
          error={error}
          onRetry={enableCamera}
          onCapture={capture}
        />
      )}

      {step === 'listen' && (
        <ListenScreen thumb={thumb} listening={listening} onListen={doThump} onSkip={skipSound} />
      )}

      {step === 'result' && verdict && (
        <ResultScreen verdict={verdict} thump={thump} onRestart={restart} />
      )}

      {error && step !== 'look' && (
        <p className="error" role="alert" style={{ margin: '0 20px 16px' }}>
          {error}
        </p>
      )}

      {guideOpen && <GuideSheet onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
