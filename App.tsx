// App.tsx
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {StatusBar} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import SettingsScreen from './src/screens/SettingsScreen';
import RemoteScreen from './src/screens/RemoteScreen';

export type RootStackParamList = {
  Settings: undefined;
  Remote: {mode: 'bt' | 'adb'};
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Settings"
          screenOptions={{
            headerStyle: {backgroundColor: '#0a0a0f'},
            headerTintColor: '#00d8ff',
            headerTitleStyle: {fontWeight: 'bold'},
            cardStyle: {backgroundColor: '#0a0a0f'},
          }}>
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{title: '📺 Gesture TV Remote'}}
          />
          <Stack.Screen
            name="Remote"
            component={RemoteScreen}
            options={{
              title: 'Remote',
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
