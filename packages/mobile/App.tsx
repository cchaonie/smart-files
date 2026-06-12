import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nProvider } from '@smart-files/shared/src/i18n';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConfigProvider, useConfig } from './src/context/ConfigContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ServerConfigScreen } from './src/screens/ServerConfigScreen';
import { PhotoUploadScreen } from './src/screens/PhotoUploadScreen';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  ServerConfig: undefined;
  PhotoUpload: { items?: import('./src/hooks/usePhotoUpload').PhotoUploadItem[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { isLoading: authLoading } = useAuth();
  const { isLoading: configLoading } = useConfig();

  if (authLoading || configLoading) {
    return null; // Or a splash screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen
          name="ServerConfig"
          component={ServerConfigScreen}
          options={{ headerShown: true, title: 'Server Settings' }}
        />
        <Stack.Screen
          name="PhotoUpload"
          component={PhotoUploadScreen}
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const asyncStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <I18nProvider storage={asyncStorage}>
        <ConfigProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ConfigProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
