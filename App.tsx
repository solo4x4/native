import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {StatusBar} from 'react-native';
import SettingsScreen from './src/screens/SettingsScreen';
import RemoteScreen from './src/screens/RemoteScreen';

export type RootStackParamList = {
  Settings: undefined;
  Remote: {mode: 'bt' | 'adb'};
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <>
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
            options={{headerShown: false}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
