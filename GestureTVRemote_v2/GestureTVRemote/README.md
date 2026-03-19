# Gesture TV Remote — React Native

Hand gesture remote control for Google TV.
**Builds on Windows** using Android Studio — no Linux needed.

## Stack

| Layer | Technology |
|---|---|
| UI | React Native 0.73 |
| Hand tracking | `react-native-mediapipe` + `react-native-vision-camera` |
| Bluetooth HID | Custom Java native module (`BTHIDModule.java`) |
| Wi-Fi ADB | Custom Java native module (`ADBWifiModule.java`) |

---

## Gesture → Key mapping

| Gesture | Key |
|---|---|
| Index finger up → move | ▲▼◀▶ Navigate |
| Pinch + release | ✓ OK / Select |
| Fast vertical swipe | 🔊 Volume |
| Fist (0 fingers) | ↩ Back |
| Open palm (4+ fingers) | ⏯ Play/Pause |
| 3 fingers (index+mid+ring) | ⌂ Home |

Also has a **touch trackpad mode** (swipe/tap) as fallback.

---

## Build on Windows — Step by Step

### Prerequisites
1. **Node.js 18+** — https://nodejs.org
2. **Android Studio** — https://developer.android.com/studio
   - During install: check Android SDK, Android SDK Platform, Android Virtual Device
3. **JDK 17** — included with Android Studio
4. **React Native CLI**
   ```
   npm install -g react-native-cli
   ```

### 1 — Set environment variables (Windows)
Open **System Properties → Environment Variables** and add:

```
ANDROID_HOME = C:\Users\<YOU>\AppData\Local\Android\Sdk
```

Add to **Path**:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

### 2 — Install dependencies
```
cd GestureTVRemote
npm install
```

### 3 — Connect your Android phone
- Enable **Developer Options**: Settings → About Phone → tap Build Number 7×
- Enable **USB Debugging**: Developer Options → USB Debugging ON
- Connect via USB → trust the PC on your phone

### 4 — Run on device
```
npx react-native run-android
```

### 5 — Build release APK
```
cd android
gradlew assembleRelease
```
APK will be at:
`android\app\build\outputs\apk\release\app-release.apk`

---

## Pairing with Google TV (Bluetooth HID)

1. Open the app → Settings → **Bluetooth HID** tab
2. Tap **Register as BT Keyboard**
3. On Google TV:
   `Settings → Remotes & Accessories → Add accessory`
4. Select **"Gesture TV Remote"** → Pair
5. Green status in app = ready

Pairing only needed once — TV remembers the device.

---

## Wi-Fi ADB mode (optional)

1. Google TV: enable USB Debugging
   `Settings → System → Developer Options → USB Debugging`
2. App → Settings → **Wi-Fi ADB** tab → enter TV IP → Connect

For the ADB mode to work on Android (without PC adb):
1. Download Android Platform Tools (arm64-v8a Linux binary)
   https://developer.android.com/tools/releases/platform-tools
2. Extract the `adb` binary, rename to `adb-arm64`
3. Place in `android/app/src/main/assets/adb-arm64`
4. Rebuild

---

## Project Structure

```
GestureTVRemote/
├── App.tsx                          # Navigation root
├── src/
│   ├── screens/
│   │   ├── SettingsScreen.tsx       # Connection setup UI
│   │   └── RemoteScreen.tsx         # Camera + overlay + toolbar
│   ├── components/
│   │   ├── GestureOverlay.tsx       # Cursor + tracking zone
│   │   └── TrackpadView.tsx         # Touch trackpad fallback
│   ├── hooks/
│   │   └── useHandTracking.ts       # MediaPipe gesture logic
│   └── controllers/
│       ├── BTHIDController.ts       # JS → native BT HID
│       └── ADBWifiController.ts     # JS → native ADB WiFi
└── android/app/src/main/java/com/gesturetvremote/
    ├── MainApplication.java         # Registers native packages
    ├── bthid/
    │   ├── BTHIDModule.java         # BluetoothHidDevice API
    │   └── BTHIDPackage.java
    └── adb/
        ├── ADBWifiModule.java       # Runs bundled adb binary
        └── ADBWifiPackage.java
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `react-native-mediapipe` build error | Check NDK version in `build.gradle`: use NDK 25+ |
| Camera black screen | Grant Camera permission in Android Settings |
| BT HID not registering | Ensure Bluetooth ON + BLUETOOTH_CONNECT permission granted |
| TV not finding device | Make sure TV is in pairing mode (Add accessory) |
| ADB "not connected" | Check TV IP, same Wi-Fi network, USB Debugging enabled |

---

## Android Requirements

- Android 9.0+ (API 28) — required for `BluetoothHidDevice`
- Bluetooth + Camera hardware
- Same Wi-Fi network as Google TV (for ADB mode)
