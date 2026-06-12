import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { BottomTabs, type TabKey } from './BottomTabs';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  badgeCount?: number;
}

export function AppLayout({ children, activeTab, onTabChange, badgeCount }: AppLayoutProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {children}
      </View>
      <BottomTabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        badgeCount={badgeCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
});

export default AppLayout;
