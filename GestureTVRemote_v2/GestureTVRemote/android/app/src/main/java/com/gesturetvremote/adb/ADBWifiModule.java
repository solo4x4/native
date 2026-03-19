// android/app/src/main/java/com/gesturetvremote/adb/ADBWifiModule.java
package com.gesturetvremote.adb;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

import androidx.annotation.NonNull;

/**
 * Runs ADB commands using a bundled adb binary (arm64).
 *
 * To bundle the adb binary:
 * 1. Download Android Platform Tools (arm64) from:
 *    https://developer.android.com/tools/releases/platform-tools
 * 2. Copy the `adb` binary to:
 *    android/app/src/main/assets/adb-arm64
 * 3. This module extracts it to the app's private storage on first run.
 *
 * Without the binary, the module falls back to a no-op with a clear error.
 */
public class ADBWifiModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "ADBWifiModule";
    private String mAdbPath = null;
    private String mAddress = "";

    public ADBWifiModule(ReactApplicationContext context) {
        super(context);
        mAdbPath = extractAdb();
    }

    @NonNull
    @Override
    public String getName() { return MODULE_NAME; }

    // ── Extract bundled adb binary ────────────────────────────
    private String extractAdb() {
        File dest = new File(getReactApplicationContext().getFilesDir(), "adb");
        if (dest.exists() && dest.canExecute()) return dest.getAbsolutePath();

        try (InputStream in = getReactApplicationContext()
                .getAssets().open("adb-arm64");
             FileOutputStream out = new FileOutputStream(dest)) {

            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            dest.setExecutable(true);
            return dest.getAbsolutePath();

        } catch (IOException e) {
            // Asset not bundled — ADB mode unavailable
            return null;
        }
    }

    // ── Connect ───────────────────────────────────────────────
    @ReactMethod
    public void connect(String ip, int port, Promise promise) {
        if (mAdbPath == null) {
            promise.reject("NO_ADB",
                "adb binary not bundled. Place adb-arm64 in android/app/src/main/assets/");
            return;
        }
        mAddress = ip + ":" + port;
        String result = runAdb("connect", mAddress);
        promise.resolve(result);
    }

    // ── Keyevent ──────────────────────────────────────────────
    @ReactMethod
    public void keyevent(String keycode, Promise promise) {
        if (mAdbPath == null || mAddress.isEmpty()) {
            promise.reject("NOT_CONNECTED", "ADB not connected");
            return;
        }
        new Thread(() -> {
            runAdb("-s", mAddress, "shell", "input", "keyevent", keycode);
            promise.resolve(null);
        }).start();
    }

    // ── Disconnect ────────────────────────────────────────────
    @ReactMethod
    public void disconnect(String address, Promise promise) {
        if (mAdbPath != null && !address.isEmpty()) {
            new Thread(() -> runAdb("disconnect", address)).start();
        }
        mAddress = "";
        promise.resolve(null);
    }

    // ── Helper: run adb binary ────────────────────────────────
    private String runAdb(String... args) {
        try {
            String[] cmd = new String[args.length + 1];
            cmd[0] = mAdbPath;
            System.arraycopy(args, 0, cmd, 1, args.length);

            Process p = Runtime.getRuntime().exec(cmd);
            p.waitFor();

            BufferedReader reader = new BufferedReader(
                new InputStreamReader(p.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            return sb.toString().trim();
        } catch (Exception e) {
            return "error: " + e.getMessage();
        }
    }
}
