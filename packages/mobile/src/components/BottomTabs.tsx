import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { FolderIcon, CloudArrowUpIcon, GearIcon, PhotosIcon } from './icons';

export type TabKey = 'files' | 'uploads' | 'settings';

interface BottomTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  badgeCount?: number; // upload badge
}

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'files', label: '文件', icon: FolderIcon },
  { key: 'uploads', label: '上传', icon: CloudArrowUpIcon },
  { key: 'settings', label: '设置', icon: GearIcon },
];

export function BottomTabs({ activeTab, onTabChange, badgeCount }: BottomTabsProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.track}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.6}
            >
              <View style={styles.iconWrap}>
                <Icon
                  size={22}
                  color={isActive ? theme.colors.accent : theme.colors.textTertiary}
                />
                {tab.key === 'uploads' && badgeCount && badgeCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: isActive ? theme.colors.accent : theme.colors.textTertiary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active tab indicator */}
      {tabs.map((tab) => {
        if (activeTab !== tab.key) return null;
        return (
          <View
            key={`indicator-${tab.key}`}
            style={[
              styles.indicator,
              {
                left: `${(100 / tabs.length) * tabs.findIndex((t) => t.key === tab.key)}%`,
                width: `${100 / tabs.length}%`,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.glassBg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
    position: 'relative',
  },
  track: {
    flexDirection: 'row',
    height: 56,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: theme.colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 2,
    backgroundColor: theme.colors.accent,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});

export default BottomTabs;
