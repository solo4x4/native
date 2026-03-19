// android/app/src/main/java/com/gesturetvremote/adb/ADBWifiPackage.java
package com.gesturetvremote.adb;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ADBWifiPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext ctx) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new ADBWifiModule(ctx));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext ctx) {
        return Collections.emptyList();
    }
}
