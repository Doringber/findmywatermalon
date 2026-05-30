import { useCallback, useEffect, useRef, useState } from 'react';
import { startCamera, analyzeVideoFrame, recordThump } from './lib/capture';
import { computeVerdict, type WatermelonVerdict } from './lib/scoring';
import type { ColorMetrics } from './lib/colorAnalysis';
import type { ThumpResult } from './lib/soundAnalysis';
import { ResultCard } from './components/ResultCard';
import { Guide } from './components/Guide';

type CameraState = 'idle' | 'starting' | 'live' | 'error';

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const scan = useCallback(() => {
    if (!videoRef.current) return;
    try {
      const c = analyzeVideoFrame(videoRef.current);
      setColors(c);
      setVerdict(computeVerdict(c, thump));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyse the frame.');
    }
  }, [thump]);

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍉 Find My Watermelon</h1>
        <p>Point your camera at a watermelon and let the AI judge how sweet it is.</p>
      </header>

      <main>
        <div className="stage">
          <video ref={videoRef} playsInline muted className="camera" />
          {cameraState === 'live' && <div className="reticle" aria-hidden />}
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

        {error && <p className="error" role="alert">{error}</p>}

        {cameraState === 'live' && (
          <div className="controls">
            <button className="btn primary" onClick={scan}>
              🔍 Scan watermelon
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
        <p>
          Runs entirely on your device — no photos or audio ever leave your phone. 🔒
        </p>
      </footer>
    </div>
  );
}
