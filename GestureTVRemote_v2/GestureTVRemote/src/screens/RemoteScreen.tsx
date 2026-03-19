// src/screens/RemoteScreen.tsx
import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import {RootStackParamList} from '../../App';
import {useHandTracking, KeyName, CursorPos} from '../hooks/useHandTracking';
import BTHIDController from '../controllers/BTHIDController';
import ADBWifiController from '../controllers/ADBWifiController';
import TrackpadView from '../components/TrackpadView';
import GestureOverlay from '../components/GestureOverlay';

const {width: W, height: H} = Dimensions.get('window');

type Route = RouteProp<RootStackParamList, 'Remote'>;

const KEY_LABELS: Record<KeyName, string> = {
  UP:         '▲  Up',
  DOWN:       '▼  Down',
  LEFT:       '◀  Left',
  RIGHT:      '▶  Right',
  OK:         '✓  OK / Select',
  BACK:       '↩  Back',
  HOME:       '⌂  Home',
  PLAY_PAUSE: '⏯  Play / Pause',
  VOL_UP:     '🔊 Volume Up',
  VOL_DOWN:   '🔉 Volume Down',
};

export default function RemoteScreen() {
  const route      = useRoute<Route>();
  const navigation = useNavigation();
  const {mode}     = route.params;

  const [cursor, setCursor]         = useState<CursorPos>(null);
  const [actionLabel, setAction]    = useState('');
  const [cameraMode, setCameraMode] = useState(true);
  const [isPinched, setIsPinched]   = useState(false);
  const labelTimeout                = useRef<ReturnType<typeof setTimeout>>();
  const actionAnim                  = useRef(new Animated.Value(0)).current;

  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('front');

  // ── key dispatch ─────────────────────────────────────────
  const sendKey = useCallback(
    (key: KeyName) => {
      if (mode === 'bt') {
        BTHIDController.sendKey(key);
      } else {
        ADBWifiController.sendKey(key);
      }

      // Show label
      setAction(KEY_LABELS[key]);
      if (labelTimeout.current) clearTimeout(labelTimeout.current);
      actionAnim.setValue(1);
      Animated.timing(actionAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }).start();
      labelTimeout.current = setTimeout(() => setAction(''), 1300);
    },
    [mode, actionAnim],
  );

  // ── hand tracking hook ───────────────────────────────────
  const {detector} = useHandTracking({
    onKey: sendKey,
    onCursor: setCursor,
  });

  // ── Vision Camera frame processor ───────────────────────
  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      detector.detectForVideo(frame, frame.timestamp);
    },
    [detector],
  );

  // ── request camera permission ────────────────────────────
  const handleRequestPerm = async () => {
    const ok = await requestPermission();
    if (!ok) setCameraMode(false);
  };

  return (
    <View style={styles.root}>
      {/* ── Camera view with hand overlay ────────────────── */}
      {cameraMode && (
        <View style={styles.cameraContainer}>
          {!hasPermission ? (
            <View style={styles.permBox}>
              <Text style={styles.permText}>Camera permission required for gesture control</Text>
              <TouchableOpacity style={styles.permBtn} onPress={handleRequestPerm}>
                <Text style={styles.permBtnText}>Grant Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCameraMode(false)}>
                <Text style={styles.switchLink}>Use touchpad instead →</Text>
              </TouchableOpacity>
            </View>
          ) : device ? (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={cameraMode}
                frameProcessor={frameProcessor}
                pixelFormat="yuv"
              />
              <GestureOverlay cursor={cursor} isPinched={isPinched} />
            </>
          ) : (
            <View style={styles.permBox}>
              <Text style={styles.permText}>No camera found</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Touchpad fallback ─────────────────────────────── */}
      {!cameraMode && (
        <TrackpadView onKey={sendKey} style={styles.trackpad} />
      )}

      {/* ── Action label overlay ──────────────────────────── */}
      {actionLabel !== '' && (
        <Animated.View style={[styles.labelBadge, {opacity: actionAnim}]}>
          <Text style={styles.labelText}>{actionLabel}</Text>
        </Animated.View>
      )}

      {/* ── Bottom toolbar ────────────────────────────────── */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={() => navigation.goBack()}>
          <Text style={styles.toolBtnText}>⚙ Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, styles.toolBtnActive]}
          onPress={() => setCameraMode(m => !m)}>
          <Text style={styles.toolBtnText}>
            {cameraMode ? '👆 Touchpad' : '📷 Camera'}
          </Text>
        </TouchableOpacity>

        {/* Quick-access buttons */}
        {(['BACK', 'HOME', 'PLAY_PAUSE'] as KeyName[]).map(k => (
          <TouchableOpacity
            key={k}
            style={styles.quickBtn}
            onPress={() => sendKey(k)}>
            <Text style={styles.quickBtnText}>
              {k === 'BACK' ? '↩' : k === 'HOME' ? '⌂' : '⏯'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0a0a0f'},

  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  trackpad: {flex: 1},

  permBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  permText: {color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 24},
  permBtn: {
    backgroundColor: '#00d8ff',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permBtnText: {color: '#000', fontWeight: '700'},
  switchLink: {color: '#555', fontSize: 13, marginTop: 8},

  labelBadge: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,216,255,0.15)',
    borderWidth: 1,
    borderColor: '#00d8ff',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  labelText: {
    color: '#00d8ff',
    fontSize: 22,
    fontWeight: '700',
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d14',
    borderTopWidth: 1,
    borderTopColor: '#1a1a24',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  toolBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  toolBtnActive: {borderColor: '#00d8ff22', backgroundColor: '#001f2a'},
  toolBtnText: {color: '#aaa', fontSize: 13},

  quickBtn: {
    marginLeft: 'auto',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161620',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  quickBtnText: {fontSize: 20},
});
