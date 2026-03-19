// src/components/GestureOverlay.tsx
import React, {useEffect, useRef} from 'react';
import {View, Animated, StyleSheet, Dimensions} from 'react-native';
import {CursorPos} from '../hooks/useHandTracking';

const {width: W, height: H} = Dimensions.get('window');
const MARGIN = 0.06;

interface Props {
  cursor: CursorPos;
  isPinched: boolean;
}

export default function GestureOverlay({cursor, isPinched}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPinched) {
      Animated.spring(scaleAnim, {
        toValue: 0.7,
        useNativeDriver: true,
        speed: 20,
      }).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
      }).start();
    }
  }, [isPinched, scaleAnim]);

  const cameraH = H - 60; // minus toolbar

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Tracking zone border */}
      <View
        style={[
          styles.trackingZone,
          {
            left:   W * MARGIN,
            top:    cameraH * MARGIN,
            width:  W * (1 - 2 * MARGIN),
            height: cameraH * (1 - 2 * MARGIN),
          },
        ]}
      />

      {/* Cursor dot */}
      {cursor && (
        <Animated.View
          style={[
            styles.cursor,
            {
              left: cursor.x * W - 14,
              top:  cursor.y * cameraH - 14,
              transform: [{scale: scaleAnim}],
              backgroundColor: isPinched ? '#ff3c3c' : '#00d8ff',
            },
          ]}
        />
      )}

      {/* Cross-hair arms when cursor present */}
      {cursor && (
        <>
          <View style={[styles.arm, styles.armH, {
            top: cursor.y * cameraH - 1,
            left: cursor.x * W - 28,
          }]} />
          <View style={[styles.arm, styles.armV, {
            top: cursor.y * cameraH - 28,
            left: cursor.x * W - 1,
          }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trackingZone: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(50,80,180,0.6)',
    borderRadius: 4,
  },
  cursor: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#00d8ff',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  arm: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  armH: {width: 18, height: 2},
  armV: {width: 2, height: 18},
});
