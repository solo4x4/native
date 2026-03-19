// src/controllers/BTHIDController.ts
/**
 * JavaScript interface to the native Android BluetoothHidDevice module.
 * The native side (BTHIDModule.java) does the actual BT work.
 */
import {NativeModules, Platform} from 'react-native';
import {KeyName} from '../hooks/useHandTracking';

const {BTHIDModule} = NativeModules;

// HID keyboard usage codes
const HID_KEY: Partial<Record<KeyName, number>> = {
  UP:    0x52,
  DOWN:  0x51,
  LEFT:  0x50,
  RIGHT: 0x4F,
  OK:    0x28,  // Enter → DPAD_CENTER on Android TV
  BACK:  0x29,  // Escape → BACK
  HOME:  0x4A,
};

// Consumer control bit masks
const CONSUMER_BIT: Partial<Record<KeyName, number>> = {
  PLAY_PAUSE: 0b00000001,
  VOL_UP:     0b00000100,
  VOL_DOWN:   0b00001000,
};

class BTHIDControllerClass {
  private _connected = false;

  get isConnected(): boolean {
    return this._connected;
  }

  async registerHID(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('[BTHIDController] Not on Android');
      return;
    }
    if (!BTHIDModule) {
      throw new Error('BTHIDModule not found — ensure the native module is linked.');
    }
    await BTHIDModule.registerHID();
  }

  async sendKey(key: KeyName): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log(`[BTHIDController stub] sendKey(${key})`);
      return;
    }
    if (!BTHIDModule) return;

    if (key in HID_KEY) {
      await BTHIDModule.sendKeyboardReport(HID_KEY[key]);
    } else if (key in CONSUMER_BIT) {
      await BTHIDModule.sendConsumerReport(CONSUMER_BIT[key]);
    }
  }

  async checkConnected(): Promise<boolean> {
    if (!BTHIDModule) return false;
    try {
      const connected = await BTHIDModule.isConnected();
      this._connected = connected;
      return connected;
    } catch {
      return false;
    }
  }

  close() {
    if (!BTHIDModule) return;
    BTHIDModule.unregister?.();
  }
}

export default new BTHIDControllerClass();
