import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startCamera,
  analyzeVideoFrame,
  recordThump,
  grabSquareFrame,
  captureThumbnail,
} from './lib/capture';
import { detectWatermelonRegion, type DetectionResult } from './lib/detection';
import { computeVerdict, type WatermelonVerdict } from './lib/scoring';
import type { ColorMetrics } from './lib/colorAnalysis';
import type { ThumpResult } from './lib/soundAnalysis';
import { Stepper, type Step } from './components/Stepper';
import { StartScreen, LookScreen, ListenScreen, ResultScreen } from './components/screens';
import { GuideSheet } from './components/GuideSheet';

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

  const [step, setStep] = useState<Step>('start');
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
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

  // Turn the camera on when we enter the Look step.
  useEffect(() => {
    if (step === 'look' && cameraState === 'idle') void enableCamera();
  }, [step, cameraState, enableCamera]);

  // Live watermelon-finder loop while looking: tracks the melon and locks on.
  useEffect(() => {
    if (step !== 'look' || cameraState !== 'live') return;
    let last = 0;
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (t - last < DETECT_INTERVAL || !videoRef.current) return;
      last = t;
      try {
        const frame = grabSquareFrame(videoRef.current, 144);
        const result = detectWatermelonRegion(frame.data, frame.size, frame.size);
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
        /* frame not ready — ignore */
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, cameraState]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const start = useCallback(() => {
    setError(null);
    setStep('look');
  }, []);

  // Capture the locked-on melon, then move to the sound step.
  const capture = useCallback(() => {
    if (!videoRef.current) return;
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
      lastBoxRef.current = null;
      setStep('listen');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that frame — try again.');
    }
  }, [detection, stopCamera]);

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
    setColors(null);
    setShape(undefined);
    setThump(null);
    setVerdict(null);
    setThumb('');
    setError(null);
    lastBoxRef.current = null;
    setStep('start');
  }, [stopCamera]);

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">🍉 Find My Watermelon</span>
        <Stepper step={step} />
        <button className="icon-btn" onClick={() => setGuideOpen(true)} aria-label="How to pick a watermelon">
          ?
        </button>
      </div>

      {step === 'start' && <StartScreen onStart={start} />}

      {step === 'look' && (
        <LookScreen
          videoRef={videoRef}
          cameraState={cameraState}
          detection={detection}
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
