import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { DetectionResult } from '../lib/detection';
import type { WatermelonVerdict } from '../lib/scoring';
import type { ThumpResult } from '../lib/soundAnalysis';
import { ResultCard } from './ResultCard';
import { burstConfetti } from '../lib/confetti';

type CameraState = 'idle' | 'starting' | 'live' | 'error';

/* ----------------------------- Start ----------------------------- */
export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen">
      <div className="screen-body">
        <div className="hero-melon" aria-hidden>
          🍉
        </div>
        <div>
          <h1 className="start-title">
            Find your <span className="pink">perfect</span> watermelon
          </h1>
        </div>
        <p className="lead start-sub">
          Your camera and a quick knock test do the work. Three steps, about 20 seconds — let's find
          a sweet one.
        </p>
      </div>
      <div className="screen-foot">
        <button className="btn primary" onClick={onStart}>
          Start the hunt 🍉
        </button>
        <p className="privacy">Runs on your device. Nothing is uploaded. 🔒</p>
      </div>
    </div>
  );
}

/* ----------------------------- Look ------------------------------ */
export function LookScreen({
  videoRef,
  cameraState,
  detection,
  error,
  onRetry,
  onCapture,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  cameraState: CameraState;
  detection: DetectionResult | null;
  error: string | null;
  onRetry: () => void;
  onCapture: () => void;
}) {
  const locked = !!detection?.found;
  const box = detection?.box;
  const live = cameraState === 'live';

  return (
    <div className="screen">
      <div className="screen-body">
        <div className="stage">
          <video ref={videoRef} playsInline muted className="camera" />

          {live && box && (
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

          {live && (
            <p className="stage-hint" aria-live="polite">
              {locked ? 'Got it! Hold steady and capture' : 'Move closer until the box locks on'}
            </p>
          )}

          {!live && (
            <div className="stage-overlay">
              {cameraState === 'starting' && <span className="spinner">Starting camera…</span>}
              {cameraState === 'error' && (
                <>
                  <p>{error ?? 'Camera unavailable.'}</p>
                  <button className="btn primary" onClick={onRetry}>
                    🔄 Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="screen-foot">
        <button className="btn primary" onClick={onCapture} disabled={!live}>
          {locked ? '📸 Got it!' : live ? '📸 Capture' : 'Opening camera…'}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Listen ----------------------------- */
export function ListenScreen({
  thumb,
  listening,
  onListen,
  onSkip,
}: {
  thumb: string;
  listening: boolean;
  onListen: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="screen">
      <div className="screen-body">
        <div className={listening ? 'listen-art' : 'listen-art idle'} aria-hidden>
          {listening ? '👂' : '🥁'}
        </div>
        <h2 className="center-title">{listening ? 'Listening… knock now!' : 'Now give it a knock'}</h2>
        <p className="lead center-sub">
          {listening
            ? 'Tap the watermelon firmly with your knuckles near the phone.'
            : 'Hold the phone close to the melon and rap it with your knuckles. A ripe one sounds deep and hollow.'}
        </p>
        {thumb && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img className="melon-thumb" src={thumb} alt="The watermelon you're checking" />
          </div>
        )}
      </div>
      <div className="screen-foot">
        <button className="btn primary" onClick={onListen} disabled={listening}>
          {listening ? 'Listening…' : '🥁 Start the knock test'}
        </button>
        <button className="link-skip" onClick={onSkip} disabled={listening}>
          Skip the sound test
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Result ----------------------------- */
export function ResultScreen({
  verdict,
  thump,
  onRestart,
}: {
  verdict: WatermelonVerdict;
  thump: ThumpResult | null;
  onRestart: () => void;
}) {
  const confettiRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if ((verdict.grade === 'excellent' || verdict.grade === 'good') && confettiRef.current) {
      burstConfetti(confettiRef.current);
    }
  }, [verdict.grade]);

  return (
    <div className="screen">
      <canvas ref={confettiRef} className="confetti" aria-hidden />
      <div className="result">
        <ResultCard verdict={verdict} thump={thump} />
      </div>
      <div className="screen-foot">
        <button className="btn primary" onClick={onRestart}>
          🍉 Check another melon
        </button>
      </div>
    </div>
  );
}
