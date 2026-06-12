import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { I18nProvider } from '@smart-files/shared/src/i18n';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConfigProvider, useConfig } from './src/context/ConfigContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PhotoUploadProvider, usePhotoUploadContext } from './src/context/PhotoUploadContext';
import { usePhotoDetection } from './src/hooks/usePhotoDetection';
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
  PhotoUpload: undefined;
  MainApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function WrappedMainApp() {
  const photoDetection = usePhotoDetection();
  const { user } = useAuth();

  useEffect(() => {
    if (user && photoDetection.permissionGranted === null) {
      photoDetection.requestPermission();
    }
  }, [user]);

  return (
    <PhotoUploadProvider onMarkSynced={photoDetection.markSynced}>
      <InnerApp photoDetection={photoDetection} />
    </PhotoUploadProvider>
  );
}

function InnerApp({ photoDetection }: { photoDetection: ReturnType<typeof usePhotoDetection> }) {
  const [activeTab, setActiveTab] = useState<TabKey>('files');
  const { badgeCount } = usePhotoUploadContext();
  const isMountedRef = useRef(true);

  // Handle notification tap → switch to uploads tab
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'upload_complete') {
        setActiveTab('uploads');
      }
    });
    return () => sub.remove();
  }, []);

  const renderScreen = useCallback(() => {
    switch (activeTab) {
      case 'files':
        return <FilesScreen photoDetection={photoDetection} />;
      case 'uploads':
        return <UploadsScreen />;
      case 'settings':
        return <SettingsScreen />;
    }
  }, [activeTab, photoDetection]);

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab} badgeCount={badgeCount}>
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
          <>
            <Stack.Screen name="MainApp" component={WrappedMainApp} />
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
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
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
