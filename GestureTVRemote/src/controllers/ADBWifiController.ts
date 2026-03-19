// src/controllers/ADBWifiController.ts
/**
 * Wi-Fi ADB controller — sends key events to Google TV over ADB TCP/IP.
 *
 * On Android there is no shell `adb` binary, so we use the native
 * ADBModule which runs ADB commands through a bundled binary or
 * delegates to the ADBWifiModule native module.
 *
 * On desktop (Metro dev) we log the key names.
 */
import {NativeModules, Platform} from 'react-native';
import {KeyName} from '../hooks/useHandTracking';

const {ADBWifiModule} = NativeModules;

const KEYCODES: Record<KeyName, string> = {
  UP:         'KEYCODE_DPAD_UP',
  DOWN:       'KEYCODE_DPAD_DOWN',
  LEFT:       'KEYCODE_DPAD_LEFT',
  RIGHT:      'KEYCODE_DPAD_RIGHT',
  OK:         'KEYCODE_DPAD_CENTER',
  BACK:       'KEYCODE_BACK',
  HOME:       'KEYCODE_HOME',
  PLAY_PAUSE: 'KEYCODE_MEDIA_PLAY_PAUSE',
  VOL_UP:     'KEYCODE_VOLUME_UP',
  VOL_DOWN:   'KEYCODE_VOLUME_DOWN',
};

class ADBWifiControllerClass {
  private _connected = false;
  private _address   = '';

  get isConnected() {
    return this._connected;
  }

  async connect(ip: string, port = 5555): Promise<boolean> {
    this._address = `${ip}:${port}`;

    if (Platform.OS !== 'android') {
      console.log(`[ADBWifi stub] connect(${this._address})`);
      this._connected = true;
      return true;
    }

    if (!ADBWifiModule) {
      throw new Error('ADBWifiModule not found — native module not linked.');
    }

    try {
      const result: string = await ADBWifiModule.connect(ip, port);
      const ok = result.toLowerCase().includes('connected') ||
                 result.toLowerCase().includes('already');
      this._connected = ok;
      return ok;
    } catch (e) {
      this._connected = false;
      return false;
    }
  }

  async sendKey(key: KeyName): Promise<void> {
    const code = KEYCODES[key];

    if (Platform.OS !== 'android') {
      console.log(`[ADBWifi stub] keyevent ${code}`);
      return;
    }

    if (!ADBWifiModule || !this._connected) return;

    try {
      await ADBWifiModule.keyevent(code);
    } catch (e) {
      console.warn('[ADBWifi] sendKey failed:', e);
      this._connected = false;
    }
  }

  disconnect() {
    if (ADBWifiModule?.disconnect) {
      ADBWifiModule.disconnect(this._address);
    }
    this._connected = false;
  }
}

export default new ADBWifiControllerClass();
