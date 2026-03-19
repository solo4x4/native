// src/hooks/useHandTracking.ts
/**
 * Hand tracking using @thinksys/react-native-mediapipe
 * Hand landmark model file (hand_landmarker.task) must be placed in:
 *   android/app/src/main/assets/hand_landmarker.task
 *
 * Download from:
 *   https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task
 */

import {useCallback, useRef} from 'react';
import {
  useHandLandmarkDetector,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@thinksys/react-native-mediapipe';

// ─────────────────────────────────────────────────────────────
// Config (mirrors original Python script)
// ─────────────────────────────────────────────────────────────
const PINCH_THRESH      = 0.06;
const PINCH_COOLDOWN    = 1000;
const DPAD_THRESHOLD    = 0.10;
const DPAD_MIN_INTERVAL = 350;
const GESTURE_COOLDOWN  = 2200;
const SMOOTHING         = 0.28;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type KeyName =
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'OK' | 'BACK' | 'HOME'
  | 'PLAY_PAUSE' | 'VOL_UP' | 'VOL_DOWN';

export type CursorPos = {x: number; y: number} | null;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function lmDist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function tipUp(lm: NormalizedLandmark[], tip: number, pip: number): boolean {
  return lm[tip].y < lm[pip].y;
}

function fingersExtended(lm: NormalizedLandmark[]): boolean[] {
  return [
    tipUp(lm, 8,  6),
    tipUp(lm, 12, 10),
    tipUp(lm, 16, 14),
    tipUp(lm, 20, 18),
  ];
}

// ─────────────────────────────────────────────────────────────
// EMA smoother
// ─────────────────────────────────────────────────────────────
class EMA {
  private alpha: number;
  private x: number | null = null;
  private y: number | null = null;
  constructor(alpha = SMOOTHING) { this.alpha = alpha; }
  update(x: number, y: number) {
    if (this.x === null) { this.x = x; this.y = y; }
    else {
      this.x += this.alpha * (x - this.x);
      this.y! += this.alpha * (y - this.y!);
    }
    return {x: this.x, y: this.y!};
  }
  reset() { this.x = null; this.y = null; }
}

// ─────────────────────────────────────────────────────────────
// Trackpad
// ─────────────────────────────────────────────────────────────
class Trackpad {
  private ax: number | null = null;
  private ay: number | null = null;
  private lastFired = 0;
  reset() { this.ax = null; this.ay = null; }
  update(nx: number, ny: number): KeyName | null {
    if (this.ax === null) { this.ax = nx; this.ay = ny; return null; }
    const dx = nx - this.ax;
    const dy = ny - this.ay;
    if ((dx * dx + dy * dy) * 4 < DPAD_THRESHOLD * DPAD_THRESHOLD) return null;
    const now = Date.now();
    if (now - this.lastFired < DPAD_MIN_INTERVAL) return null;
    const dir: KeyName = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'LEFT' : 'RIGHT')
      : (dy > 0 ? 'DOWN' : 'UP');
    this.ax = nx; this.ay = ny; this.lastFired = now;
    return dir;
  }
  get anchor() { return this.ax !== null ? {x: this.ax, y: this.ay!} : null; }
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useHandTracking(options: {
  onKey: (k: KeyName) => void;
  onCursor: (pos: CursorPos) => void;
}) {
  const {onKey, onCursor} = options;
  const ema         = useRef(new EMA()).current;
  const pad         = useRef(new Trackpad()).current;
  const pinchDown   = useRef(false);
  const lastPinch   = useRef(0);
  const lastBtn     = useRef('');
  const lastBtnTime = useRef(0);
  const prevY       = useRef<number | null>(null);
  const prevTime    = useRef<number | null>(null);

  const onResults = useCallback((result: HandLandmarkerResult) => {
    const hand = result.landmarks?.[0];

    if (!hand || hand.length < 21) {
      ema.reset(); pad.reset();
      pinchDown.current = false;
      prevY.current = null;
      onCursor(null);
      return;
    }

    const ext  = fingersExtended(hand);
    const n    = ext.filter(Boolean).length;
    const now  = Date.now();

    // ── POINTER MODE: only index finger up ──────────────────
    if (n === 1 && ext[0]) {
      const smooth = ema.update(hand[8].x, hand[8].y);
      onCursor(smooth);

      const dpad = pad.update(smooth.x, smooth.y);
      if (dpad) onKey(dpad);

      // Pinch → OK
      const isPinched = lmDist(hand[4], hand[8]) < PINCH_THRESH;
      if (pinchDown.current && !isPinched) {
        if (now - lastPinch.current > PINCH_COOLDOWN) {
          onKey('OK');
          lastPinch.current = now;
        }
      }
      pinchDown.current = isPinched;

      // Fast vertical swipe → volume
      if (prevY.current !== null && prevTime.current !== null) {
        const dt = (now - prevTime.current) / 1000;
        if (dt > 0) {
          const vy = (smooth.y - prevY.current) / dt;
          if (Math.abs(vy) > 1.5 && now - lastBtnTime.current > 500) {
            onKey(vy > 0 ? 'VOL_DOWN' : 'VOL_UP');
            lastBtnTime.current = now;
          }
        }
      }
      prevY.current    = smooth.y;
      prevTime.current = now;

    // ── GESTURE MODE ────────────────────────────────────────
    } else {
      pad.reset(); ema.reset();
      prevY.current = null;
      onCursor(null);

      let raw: KeyName | null = null;
      if (n === 0)                              raw = 'BACK';
      else if (n >= 4)                          raw = 'PLAY_PAUSE';
      else if (n === 3 && ext[0] && ext[1] && ext[2]) raw = 'HOME';

      if (raw) {
        if (raw !== lastBtn.current || now - lastBtnTime.current > GESTURE_COOLDOWN) {
          lastBtn.current     = raw;
          lastBtnTime.current = now;
          onKey(raw);
        }
      }
    }
  }, [ema, pad, onKey, onCursor]);

  // @thinksys/react-native-mediapipe hook
  const {cameraViewLayoutChangeHandler, cameraViewRef} =
    useHandLandmarkDetector(
      {
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence:  0.6,
        minTrackingConfidence:      0.55,
        // Model file bundled in assets/hand_landmarker.task
        modelAssetPath: 'hand_landmarker.task',
      },
      'back',       // camera facing
      onResults,
      (error: string) => console.warn('[HandTracker]', error),
    );

  return {cameraViewRef, cameraViewLayoutChangeHandler};
}

// Re-export for use in other files
const lastBtnTime = {current: 0};
