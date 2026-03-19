// src/hooks/useHandTracking.ts
/**
 * Hand tracking hook using react-native-mediapipe.
 * Returns the current gesture classification and cursor position.
 *
 * Gesture table (mirrors desktop Python script):
 *  1 finger (index) up   → POINTER mode — tracks position
 *  Pinch (index+thumb)   → OK
 *  Fast vertical move    → VOL_UP / VOL_DOWN
 *  0 fingers (fist)      → BACK
 *  4+ fingers            → PLAY_PAUSE
 *  3 fingers (idx+mid+ring) → HOME
 */

import {useRef, useCallback} from 'react';
import {
  useHandLandmarkDetector,
  HandLandmarkDetectionResultBundle,
  Landmark,
} from 'react-native-mediapipe';
import {Camera} from 'react-native-vision-camera';

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const PINCH_THRESH      = 0.06;   // normalised distance thumb↔index
const PINCH_COOLDOWN    = 1000;   // ms
const DPAD_THRESHOLD    = 0.10;   // normalised distance to fire DPAD
const DPAD_MIN_INTERVAL = 350;    // ms
const GESTURE_COOLDOWN  = 2200;   // ms
const SMOOTHING         = 0.28;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type KeyName =
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'OK' | 'BACK' | 'HOME'
  | 'PLAY_PAUSE' | 'VOL_UP' | 'VOL_DOWN';

export type CursorPos = {x: number; y: number} | null;

type HandTrackingOptions = {
  onKey: (key: KeyName) => void;
  onCursor: (pos: CursorPos) => void;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function dist(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function tipUp(lm: Landmark[], tip: number, pip: number): boolean {
  return lm[tip].y < lm[pip].y;
}

function fingersExtended(lm: Landmark[]): boolean[] {
  return [
    tipUp(lm, 8,  6),   // index
    tipUp(lm, 12, 10),  // middle
    tipUp(lm, 16, 14),  // ring
    tipUp(lm, 20, 18),  // pinky
  ];
}

// ─────────────────────────────────────────────────────────────
// EMA smoother
// ─────────────────────────────────────────────────────────────
class EMA {
  private alpha: number;
  private x: number | null = null;
  private y: number | null = null;

  constructor(alpha = SMOOTHING) {
    this.alpha = alpha;
  }

  update(x: number, y: number): {x: number; y: number} {
    if (this.x === null) {
      this.x = x;
      this.y = y;
    } else {
      this.x += this.alpha * (x - this.x);
      this.y! += this.alpha * (y - this.y!);
    }
    return {x: this.x, y: this.y!};
  }

  reset() {
    this.x = null;
    this.y = null;
  }
}

// ─────────────────────────────────────────────────────────────
// Virtual trackpad
// ─────────────────────────────────────────────────────────────
class Trackpad {
  private ax: number | null = null;
  private ay: number | null = null;
  private lastFired = 0;

  reset() {
    this.ax = null;
    this.ay = null;
  }

  update(nx: number, ny: number): KeyName | null {
    if (this.ax === null) {
      this.ax = nx;
      this.ay = ny;
      return null;
    }
    const dx = nx - this.ax;
    const dy = ny - this.ay;
    const dist2 = dx * dx + dy * dy;
    if (dist2 * 4 < DPAD_THRESHOLD * DPAD_THRESHOLD) return null;

    const now = Date.now();
    if (now - this.lastFired < DPAD_MIN_INTERVAL) return null;

    const direction: KeyName =
      Math.abs(dx) >= Math.abs(dy)
        ? dx > 0 ? 'LEFT' : 'RIGHT'
        : dy > 0 ? 'DOWN' : 'UP';

    this.ax = nx;
    this.ay = ny;
    this.lastFired = now;
    return direction;
  }

  get anchor(): {x: number; y: number} | null {
    return this.ax !== null ? {x: this.ax, y: this.ay!} : null;
  }
}

// ─────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────
export function useHandTracking({onKey, onCursor}: HandTrackingOptions) {
  const ema         = useRef(new EMA()).current;
  const pad         = useRef(new Trackpad()).current;
  const pinchDown   = useRef(false);
  const lastPinch   = useRef(0);
  const lastBtn     = useRef('');
  const lastBtnTime = useRef(0);
  const prevY       = useRef<number | null>(null);
  const prevTime    = useRef<number | null>(null);

  const onResults = useCallback(
    (results: HandLandmarkDetectionResultBundle) => {
      const hand = results.results[0]?.landmarks?.[0];

      if (!hand || hand.length < 21) {
        ema.reset();
        pad.reset();
        pinchDown.current = false;
        prevY.current = null;
        onCursor(null);
        return;
      }

      const lm  = hand;
      const ext = fingersExtended(lm);
      const n   = ext.filter(Boolean).length;
      const [idx] = ext;
      const now = Date.now();

      // ── POINTER MODE: only index finger up ────────────────
      if (n === 1 && idx) {
        const smooth = ema.update(lm[8].x, lm[8].y);
        onCursor(smooth);

        // DPAD from movement
        const dpad = pad.update(smooth.x, smooth.y);
        if (dpad) onKey(dpad);

        // Pinch → OK (thumb tip ↔ index tip)
        const isPinched = dist(lm[4], lm[8]) < PINCH_THRESH;
        if (pinchDown.current && !isPinched) {
          if (now - lastPinch.current > PINCH_COOLDOWN) {
            onKey('OK');
            lastPinch.current = now;
          }
        }
        pinchDown.current = isPinched;

        // Velocity swipe → volume
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

      // ── GESTURE MODE ──────────────────────────────────────
      } else {
        pad.reset();
        ema.reset();
        prevY.current = null;
        onCursor(null);

        let raw: KeyName | null = null;
        if (n === 0)       raw = 'BACK';
        else if (n >= 4)   raw = 'PLAY_PAUSE';
        else if (n === 3 && ext[0] && ext[1] && ext[2]) raw = 'HOME';

        if (raw) {
          if (
            raw !== lastBtn.current ||
            now - lastBtnTime.current > GESTURE_COOLDOWN
          ) {
            lastBtn.current     = raw;
            lastBtnTime.current = now;
            onKey(raw);
          }
        }
      }
    },
    [ema, pad, onKey, onCursor],
  );

  // react-native-mediapipe hand detector
  const detector = useHandLandmarkDetector(
    {
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence:  0.6,
      minTrackingConfidence:      0.55,
      runningMode: 'VIDEO',
    },
    undefined,  // model path — library bundles the model
    onResults,
    (error) => console.warn('[HandTracker] error', error),
  );

  return {detector};
}
