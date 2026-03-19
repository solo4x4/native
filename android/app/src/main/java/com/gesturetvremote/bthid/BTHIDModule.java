// android/app/src/main/java/com/gesturetvremote/bthid/BTHIDModule.java
package com.gesturetvremote.bthid;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHidDevice;
import android.bluetooth.BluetoothHidDeviceAppSdpSettings;
import android.bluetooth.BluetoothProfile;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.concurrent.Executors;

@RequiresApi(api = Build.VERSION_CODES.P)
public class BTHIDModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "BTHIDModule";

    // ── HID descriptor: keyboard (report 1) + consumer (report 2) ─
    private static final byte[] HID_DESCRIPTOR = {
        // Keyboard
        0x05, 0x01, 0x09, 0x06, (byte)0xA1, 0x01,
        (byte)0x85, 0x01,
        0x05, 0x07, 0x19, (byte)0xE0, 0x29, (byte)0xE7,
        0x15, 0x00, 0x25, 0x01, 0x75, 0x01, (byte)0x95, 0x08,
        (byte)0x81, 0x02,
        (byte)0x95, 0x01, 0x75, 0x08, (byte)0x81, 0x01,
        (byte)0x95, 0x06, 0x75, 0x08, 0x15, 0x00, 0x26, (byte)0xFF, 0x00,
        0x05, 0x07, 0x19, 0x00, 0x29, (byte)0xFF,
        (byte)0x81, 0x00,
        (byte)0xC0,
        // Consumer control
        0x05, 0x0C, 0x09, 0x01, (byte)0xA1, 0x01,
        (byte)0x85, 0x02,
        0x15, 0x00, 0x25, 0x01, 0x75, 0x01, (byte)0x95, 0x08,
        0x0A, (byte)0xCD, 0x00,
        0x0A, (byte)0xE2, 0x00,
        0x0A, (byte)0xE9, 0x00,
        0x0A, (byte)0xEA, 0x00,
        0x0A, (byte)0xB5, 0x00,
        0x0A, (byte)0xB6, 0x00,
        0x0A, (byte)0xB7, 0x00,
        0x09, 0x00,
        (byte)0x81, 0x02,
        (byte)0xC0,
    };

    private BluetoothHidDevice  mHidDevice     = null;
    private BluetoothDevice     mConnectedHost = null;
    private final ReactApplicationContext mCtx;

    public BTHIDModule(ReactApplicationContext context) {
        super(context);
        mCtx = context;
    }

    @NonNull
    @Override
    public String getName() { return MODULE_NAME; }

    // ── Register as HID device ────────────────────────────────
    @ReactMethod
    public void registerHID(final Promise promise) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            promise.reject("BT_OFF", "Bluetooth is disabled");
            return;
        }

        BluetoothProfile.ServiceListener listener = new BluetoothProfile.ServiceListener() {
            @Override
            public void onServiceConnected(int profile, BluetoothProfile proxy) {
                mHidDevice = (BluetoothHidDevice) proxy;

                BluetoothHidDeviceAppSdpSettings sdp = new BluetoothHidDeviceAppSdpSettings(
                    "Gesture TV Remote",
                    "GestureTVRemote",
                    "GestureTVApp",
                    BluetoothHidDevice.SUBCLASS1_KEYBOARD,
                    HID_DESCRIPTOR
                );

                mHidDevice.registerApp(
                    sdp, null, null,
                    Executors.newSingleThreadExecutor(),
                    new BluetoothHidDevice.Callback() {
                        @Override
                        public void onConnectionStateChanged(BluetoothDevice device, int state) {
                            if (state == BluetoothProfile.STATE_CONNECTED) {
                                mConnectedHost = device;
                            } else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                                mConnectedHost = null;
                            }
                        }
                        @Override
                        public void onAppStatusChanged(BluetoothDevice device, boolean registered) {
                            if (registered) {
                                promise.resolve("registered");
                            } else {
                                promise.reject("HID_FAIL", "App registration failed");
                            }
                        }
                    }
                );
            }

            @Override
            public void onServiceDisconnected(int profile) {
                mHidDevice = null;
            }
        };

        adapter.getProfileProxy(mCtx, listener, BluetoothProfile.HID_DEVICE);
    }

    // ── Send keyboard HID report ──────────────────────────────
    @ReactMethod
    public void sendKeyboardReport(int hidCode, final Promise promise) {
        if (mHidDevice == null || mConnectedHost == null) {
            promise.reject("NOT_CONNECTED", "No HID host connected");
            return;
        }
        // Report: [modifier, reserved, key1..key6]
        byte[] down = {0x00, 0x00, (byte) hidCode, 0, 0, 0, 0, 0};
        byte[] up   = {0x00, 0x00, 0, 0, 0, 0, 0, 0};
        boolean ok = mHidDevice.sendReport(mConnectedHost, 1, down);
        try { Thread.sleep(50); } catch (InterruptedException ignored) {}
        mHidDevice.sendReport(mConnectedHost, 1, up);
        if (ok) promise.resolve(null);
        else    promise.reject("SEND_FAIL", "sendReport failed");
    }

    // ── Send consumer control report ─────────────────────────
    @ReactMethod
    public void sendConsumerReport(int bitMask, final Promise promise) {
        if (mHidDevice == null || mConnectedHost == null) {
            promise.reject("NOT_CONNECTED", "No HID host connected");
            return;
        }
        byte[] on  = {(byte) bitMask};
        byte[] off = {0x00};
        mHidDevice.sendReport(mConnectedHost, 2, on);
        try { Thread.sleep(50); } catch (InterruptedException ignored) {}
        mHidDevice.sendReport(mConnectedHost, 2, off);
        promise.resolve(null);
    }

    // ── Status ───────────────────────────────────────────────
    @ReactMethod
    public void isConnected(Promise promise) {
        promise.resolve(mConnectedHost != null);
    }

    // ── Unregister ───────────────────────────────────────────
    @ReactMethod
    public void unregister(Promise promise) {
        if (mHidDevice != null) {
            mHidDevice.unregisterApp();
            mHidDevice = null;
        }
        mConnectedHost = null;
        if (promise != null) promise.resolve(null);
    }
}
