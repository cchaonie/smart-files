import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { UserIcon, GearIcon, GlobeIcon } from '../components/icons';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { apiUrl } = useConfig();
  const { t } = useI18n();
  const navigation = useNavigation();

  const handleLogout = () => {
    Alert.alert('退出登录', '确认退出？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>设置</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <UserIcon size={28} color={theme.colors.accent} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || user?.email || '用户'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服务器</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => (navigation as any).navigate('ServerConfig')}
          >
            <View style={styles.rowIcon}>
              <GlobeIcon size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>服务器地址</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{apiUrl || '未配置'}</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>账户</Text>

          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <View style={styles.rowIcon}>
              <Text style={styles.dangerIcon}>🚪</Text>
            </View>
            <Text style={[styles.rowLabel, { color: theme.colors.danger }]}>退出登录</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: { fontSize: 22, fontWeight: '600', color: theme.colors.text },
  content: { paddingBottom: 32 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginHorizontal: 16, marginTop: 16, marginBottom: 24,
    padding: 16, borderRadius: theme.radii.lg,
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: theme.colors.accentGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  profileEmail: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: theme.colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1,
    marginHorizontal: 16, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', gap: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, color: theme.colors.text },
  rowValue: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 1 },
  rowArrow: { fontSize: 20, color: theme.colors.textTertiary },
  dangerIcon: { fontSize: 20 },
});

export default SettingsScreen;
