import React, { useState, useCallback } from 'react';
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
import { ServerConfigScreen } from './src/screens/ServerConfigScreen';
import { PhotoUploadScreen } from './src/screens/PhotoUploadScreen';
import { AppLayout } from './src/components/AppLayout';
import { FilesScreen } from './src/screens/FilesScreen';
import { UploadsScreen } from './src/screens/UploadsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import type { TabKey } from './src/components/BottomTabs';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ServerConfig: undefined;
  PhotoUpload: { items?: import('./src/hooks/usePhotoUpload').PhotoUploadItem[] } | undefined;
  MainApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainAppScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('files');

  const renderScreen = useCallback(() => {
    switch (activeTab) {
      case 'files': return <FilesScreen />;
      case 'uploads': return <UploadsScreen />;
      case 'settings': return <SettingsScreen />;
    }
  }, [activeTab]);

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderScreen()}
    </AppLayout>
  );
}

function AppNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: configLoading } = useConfig();

  if (authLoading || configLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        {user ? (
          // Authenticated stack
          <>
            <Stack.Screen name="MainApp" component={MainAppScreen} />
            <Stack.Screen
              name="PhotoUpload"
              component={PhotoUploadScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
            <Stack.Screen
              name="ServerConfig"
              component={ServerConfigScreen}
              options={{ headerShown: true, title: '服务器配置' }}
            />
          </>
        ) : (
          // Public stack
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen
              name="ServerConfig"
              component={ServerConfigScreen}
              options={{ headerShown: true, title: '服务器配置' }}
            />
          </>
        )}
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
      <StatusBar style="dark" />
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
