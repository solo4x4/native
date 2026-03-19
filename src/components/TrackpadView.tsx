// src/components/TrackpadView.tsx
import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  ViewStyle,
} from 'react-native';
import {KeyName} from '../hooks/useHandTracking';

const {width: W, height: H} = Dimensions.get('window');

const SWIPE_THRESHOLD  = 28;   // px
const SWIPE_COOLDOWN   = 280;  // ms
const FLING_VELOCITY   = 0.7;  // px/ms → volume
const FLING_COOLDOWN   = 500;  // ms

interface Props {
  onKey: (key: KeyName) => void;
  style?: ViewStyle;
}

export default function TrackpadView({onKey, style}: Props) {
  const startRef    = useRef<{x: number; y: number; t: number} | null>(null);
  const anchorRef   = useRef<{x: number; y: number} | null>(null);
  const lastDpad    = useRef(0);
  const lastFling   = useRef(0);
  const longPress   = useRef<ReturnType<typeof setTimeout>>();
  const didFireLong = useRef(false);
  const [ripple, setRipple] = useState<{x: number; y: number} | null>(null);
  const rippleAnim = useRef(new Animated.Value(0)).current;

  const showRipple = (x: number, y: number) => {
    setRipple({x, y});
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start(() => setRipple(null));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        const {pageX: x, pageY: y} = e.nativeEvent;
        startRef.current  = {x, y, t: Date.now()};
        anchorRef.current = {x, y};
        didFireLong.current = false;
        showRipple(x, y);

        // Long press → BACK
        longPress.current = setTimeout(() => {
          didFireLong.current = true;
          onKey('BACK');
        }, 700);
      },

      onPanResponderMove: (e) => {
        if (!anchorRef.current) return;
        const {pageX: x, pageY: y} = e.nativeEvent;
        const dx = x - anchorRef.current.x;
        const dy = y - anchorRef.current.y;
        const d  = Math.sqrt(dx * dx + dy * dy);

        // Cancel long press if moved
        if (d > 10 && longPress.current) {
          clearTimeout(longPress.current);
        }

        if (d < SWIPE_THRESHOLD) return;
        const now = Date.now();
        if (now - lastDpad.current < SWIPE_COOLDOWN) return;

        // Check fling velocity for volume
        const start = startRef.current!;
        const dt = now - start.t;
        const vy = dy / dt;
        if (Math.abs(vy) > FLING_VELOCITY && now - lastFling.current > FLING_COOLDOWN) {
          onKey(vy > 0 ? 'VOL_DOWN' : 'VOL_UP');
          lastFling.current = now;
          anchorRef.current = {x, y};
          lastDpad.current = now;
          return;
        }

        // DPAD direction
        const direction: KeyName =
          Math.abs(dx) >= Math.abs(dy)
            ? dx > 0 ? 'RIGHT' : 'LEFT'
            : dy > 0 ? 'DOWN' : 'UP';

        onKey(direction);
        anchorRef.current = {x, y};
        lastDpad.current  = now;
      },

      onPanResponderRelease: (e) => {
        if (longPress.current) clearTimeout(longPress.current);
        const {pageX: x, pageY: y} = e.nativeEvent;
        const start = startRef.current;
        if (!start || didFireLong.current) return;

        const dx = x - start.x;
        const dy = y - start.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        const dt = Date.now() - start.t;

        // Tap (small movement, short time)
        if (d < 20 && dt < 500) {
          onKey('OK');
          showRipple(x, y);
        }

        startRef.current  = null;
        anchorRef.current = null;
      },
    }),
  ).current;

  return (
    <View style={[styles.root, style]} {...panResponder.panHandlers}>
      {/* Background grid dots */}
      <View style={styles.gridContainer} pointerEvents="none">
        {Array.from({length: 6}).map((_, r) =>
          Array.from({length: 10}).map((_, c) => (
            <View
              key={`${r}-${c}`}
              style={[
                styles.dot,
                {
                  top:  `${(r + 1) * (100 / 7)}%`,
                  left: `${(c + 1) * (100 / 11)}%`,
                },
              ]}
            />
          )),
        )}
      </View>

      {/* Hint */}
      <Text style={styles.hint} pointerEvents="none">
        {'Swipe  ◀ ▲ ▼ ▶  to navigate\nTap to select  •  Long press = Back\nFast swipe up/down = Volume'}
      </Text>

      {/* Ripple */}
      {ripple && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ripple,
            {
              left: ripple.x - 40,
              top:  ripple.y - 40,
              opacity: rippleAnim.interpolate({
                inputRange:  [0, 0.5, 1],
                outputRange: [0.5, 0.3, 0],
              }),
              transform: [{
                scale: rippleAnim.interpolate({
                  inputRange:  [0, 1],
                  outputRange: [0.2, 1],
                }),
              }],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#08080f',
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#1a1a28',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    color: '#2a2a40',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 28,
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00d8ff',
  },
});
