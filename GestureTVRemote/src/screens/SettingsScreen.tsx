// src/screens/SettingsScreen.tsx
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../App';
import BTHIDController from '../controllers/BTHIDController';
import ADBWifiController from '../controllers/ADBWifiController';

type Nav = StackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const [mode, setMode] = useState<'bt' | 'adb'>('bt');
  const [tvIp, setTvIp] = useState('192.168.1.109');
  const [tvPort, setTvPort] = useState('5555');
  const [btStatus, setBtStatus] = useState<'idle' | 'registering' | 'connected' | 'error'>('idle');
  const [adbStatus, setAdbStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [btDeviceName, setBtDeviceName] = useState('');

  useEffect(() => {
    // Check BT status on mount
    setBtStatus(BTHIDController.isConnected ? 'connected' : 'idle');
  }, []);

  const handleBTRegister = async () => {
    setBtStatus('registering');
    try {
      await BTHIDController.registerHID();
      setBtStatus('idle');
      Alert.alert(
        'Bluetooth HID Registered',
        'Now go to your Google TV:\nSettings → Remotes & Accessories → Add accessory\n\nSelect "Gesture TV Remote" to pair.',
      );
    } catch (e: any) {
      setBtStatus('error');
      Alert.alert('Bluetooth Error', e.message || 'Failed to register HID device');
    }
  };

  const handleADBConnect = async () => {
    setAdbStatus('connecting');
    try {
      const ok = await ADBWifiController.connect(tvIp, parseInt(tvPort, 10));
      setAdbStatus(ok ? 'connected' : 'error');
      if (!ok) {
        Alert.alert('ADB Failed', 'Could not connect. Check IP and that USB Debugging is enabled on TV.');
      }
    } catch (e: any) {
      setAdbStatus('error');
      Alert.alert('ADB Error', e.message);
    }
  };

  const handleStart = () => {
    nav.navigate('Remote', {mode});
  };

  const btStatusColor = {
    idle: '#888',
    registering: '#00d8ff',
    connected: '#00ef6f',
    error: '#ff4444',
  }[btStatus];

  const adbStatusText = {
    idle: 'Not connected',
    connecting: 'Connecting…',
    connected: '● Connected',
    error: '● Failed',
  }[adbStatus];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode toggle */}
      <Text style={styles.sectionTitle}>Connection Mode</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'bt' && styles.toggleActive]}
          onPress={() => setMode('bt')}>
          <Text style={[styles.toggleText, mode === 'bt' && styles.toggleTextActive]}>
            🔵 Bluetooth HID
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'adb' && styles.toggleActive]}
          onPress={() => setMode('adb')}>
          <Text style={[styles.toggleText, mode === 'adb' && styles.toggleTextActive]}>
            📡 Wi-Fi ADB
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bluetooth section */}
      {mode === 'bt' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bluetooth HID Setup</Text>
          <Text style={styles.hint}>
            Your phone will act as a Bluetooth keyboard.{'\n'}
            Google TV pairs with it — no developer mode needed.
          </Text>
          <View style={styles.steps}>
            <Text style={styles.step}>① Tap Register below</Text>
            <Text style={styles.step}>② On TV: Settings → Remotes → Add accessory</Text>
            <Text style={styles.step}>③ Select "Gesture TV Remote" → Pair</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.dot, {backgroundColor: btStatusColor}]} />
            <Text style={[styles.statusText, {color: btStatusColor}]}>
              {btStatus === 'idle' && 'Not registered'}
              {btStatus === 'registering' && 'Registering…'}
              {btStatus === 'connected' && `Connected${btDeviceName ? ' · ' + btDeviceName : ''}`}
              {btStatus === 'error' && 'Error — try again'}
            </Text>
            {btStatus === 'registering' && <ActivityIndicator color="#00d8ff" style={{marginLeft: 8}} />}
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, btStatus === 'registering' && styles.btnDisabled]}
            onPress={handleBTRegister}
            disabled={btStatus === 'registering'}>
            <Text style={styles.actionBtnText}>📲 Register as BT Keyboard</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ADB section */}
      {mode === 'adb' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wi-Fi ADB Setup</Text>
          <Text style={styles.hint}>
            TV must have USB Debugging ON:{'\n'}
            Settings → System → Developer Options → USB Debugging
          </Text>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>TV IP</Text>
            <TextInput
              style={styles.input}
              value={tvIp}
              onChangeText={setTvIp}
              placeholder="192.168.1.x"
              placeholderTextColor="#444"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Port</Text>
            <TextInput
              style={[styles.input, {flex: 0.3}]}
              value={tvPort}
              onChangeText={setTvPort}
              placeholder="5555"
              placeholderTextColor="#444"
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.statusText, {
            color: adbStatus === 'connected' ? '#00ef6f' : adbStatus === 'error' ? '#ff4444' : '#888',
            marginBottom: 12,
          }]}>
            {adbStatusText}
          </Text>

          <TouchableOpacity
            style={[styles.actionBtn, adbStatus === 'connecting' && styles.btnDisabled]}
            onPress={handleADBConnect}
            disabled={adbStatus === 'connecting'}>
            {adbStatus === 'connecting'
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.actionBtnText}>Connect via ADB</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Detection mode */}
      <Text style={styles.sectionTitle}>Gesture Detection</Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>📷 Camera + MediaPipe hand tracking</Text>
        <Text style={styles.infoSubText}>
          Point your index finger to navigate.{'\n'}
          Pinch to select • Fist = Back • Open palm = Play/Pause
        </Text>
      </View>

      {/* Start */}
      <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
        <Text style={styles.startBtnText}>▶  Start Remote</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0f'},
  content: {padding: 20, paddingBottom: 40},
  sectionTitle: {
    color: '#00d8ff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 24,
  },
  toggleRow: {flexDirection: 'row', gap: 10, marginBottom: 8},
  toggleBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#111',
    alignItems: 'center',
  },
  toggleActive: {
    borderColor: '#00d8ff',
    backgroundColor: '#001f2a',
  },
  toggleText: {color: '#666', fontSize: 14, fontWeight: '600'},
  toggleTextActive: {color: '#00d8ff'},
  section: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e1e2a',
    marginBottom: 8,
  },
  hint: {color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 14},
  steps: {gap: 6, marginBottom: 16},
  step: {color: '#aaa', fontSize: 13},
  statusRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  dot: {width: 8, height: 8, borderRadius: 4, marginRight: 8},
  statusText: {fontSize: 13},
  actionBtn: {
    backgroundColor: '#00d8ff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnDisabled: {opacity: 0.5},
  actionBtnText: {color: '#000', fontWeight: '700', fontSize: 15},
  inputRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10},
  inputLabel: {color: '#888', width: 36, fontSize: 13},
  input: {
    flex: 1,
    backgroundColor: '#1a1a22',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  infoBox: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e1e2a',
  },
  infoText: {color: '#ccc', fontSize: 14, fontWeight: '600', marginBottom: 8},
  infoSubText: {color: '#666', fontSize: 13, lineHeight: 20},
  startBtn: {
    backgroundColor: '#00d8ff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  startBtnText: {color: '#000', fontWeight: '800', fontSize: 18},
});
