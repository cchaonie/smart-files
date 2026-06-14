import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { useNavigation } from '@react-navigation/native';
import { authApi } from '../api/auth';
import { theme } from '../theme';
import { UserIcon, GearIcon, GlobeIcon, LockIcon } from '../components/icons';
import {
  checkForUpdate,
  downloadApk,
  installApk,
  saveDownloadedPath,
  clearDownloadedPath,
  getCurrentVersion,
  type UpdateInfo,
} from '../services/updateService';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { apiUrl } = useConfig();
  const { t } = useI18n();
  const navigation = useNavigation();

  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Update check state
  const [updateStatus, setUpdateStatus] = useState<
    | { type: 'idle' }
    | { type: 'checking' }
    | { type: 'latest' }
    | { type: 'available'; info: UpdateInfo }
    | { type: 'downloading'; progress: number }
    | { type: 'downloaded'; localPath: string }
    | { type: 'error'; message: string }
  >({ type: 'idle' });

  const currentVersion = getCurrentVersion();

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus({ type: 'checking' });
    try {
      const info = await checkForUpdate();
      if (!info || !info.hasUpdate) {
        setUpdateStatus({ type: 'latest' });
        setTimeout(() => setUpdateStatus({ type: 'idle' }), 3000);
      } else if (!info.downloadUrl) {
        setUpdateStatus({ type: 'error', message: t.downloadFailed || '没有可用的 APK 下载链接' });
      } else {
        setUpdateStatus({ type: 'available', info });
      }
    } catch (e: any) {
      setUpdateStatus({ type: 'error', message: e?.message || t.updateCheckFailed });
    }
  }, [t]);

  const handleDownload = useCallback(async () => {
    if (updateStatus.type !== 'available' || !updateStatus.info.downloadUrl) return;

    setUpdateStatus({ type: 'downloading', progress: 0 });
    try {
      const localPath = await downloadApk(updateStatus.info.downloadUrl, (progress) => {
        setUpdateStatus({ type: 'downloading', progress });
      });
      await saveDownloadedPath(localPath);
      setUpdateStatus({ type: 'downloaded', localPath });
    } catch (e: any) {
      setUpdateStatus({ type: 'error', message: e?.message || t.downloadFailed });
    }
  }, [updateStatus, t]);

  const handleInstall = useCallback(async () => {
    if (updateStatus.type !== 'downloaded') return;
    try {
      await installApk(updateStatus.localPath);
    } catch (e: any) {
      Alert.alert(t.error || '错误', e?.message || t.downloadFailed);
    }
  }, [updateStatus, t]);

  const handleLogout = () => {
    Alert.alert('退出登录', '确认退出？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ]);
  };

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 8) {
      setPwError(t.minChars?.replace?.('{n}', '8') || '密码至少8位');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError(t.passwordsDoNotMatch || '两次密码不一致');
      return;
    }
    setPwLoading(true);
    setPwError(null);
    try {
      await authApi.changePassword(currentPw, newPw);
      Alert.alert(t.passwordUpdated || '成功', t.passwordUpdated || '密码已更新');
      setShowChangePw(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e: any) {
      setPwError(e?.response?.data?.message || e?.message || t.failedToChangePassword || '修改密码失败');
    } finally {
      setPwLoading(false);
    }
  };

  const renderUpdateRow = () => {
    const isActive = updateStatus.type !== 'idle';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          if (updateStatus.type === 'available') {
            handleDownload();
          } else if (updateStatus.type === 'downloaded') {
            handleInstall();
          } else if (updateStatus.type === 'idle' || updateStatus.type === 'error' || updateStatus.type === 'latest') {
            handleCheckUpdate();
          }
        }}
        disabled={updateStatus.type === 'checking' || updateStatus.type === 'downloading'}
      >
        <View style={styles.rowIcon}>
          <GearIcon size={20} color={theme.colors.textSecondary} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>
            {updateStatus.type === 'checking' && t.checkingUpdate}
            {updateStatus.type === 'latest' && (t.alreadyLatest || '已是最新版本')}
            {updateStatus.type === 'available' && (t.newVersionFound?.replace('{version}', updateStatus.info.latestVersion) || `发现新版本 v${updateStatus.info.latestVersion}`)}
            {updateStatus.type === 'downloading' && (t.downloadingUpdate?.replace('{progress}', String(updateStatus.progress)) || `下载更新 ${updateStatus.progress}%`)}
            {updateStatus.type === 'downloaded' && (t.downloadComplete || '下载完成')}
            {updateStatus.type === 'error' && t.updateCheckFailed}
            {updateStatus.type === 'idle' && (t.checkUpdate || '检查更新')}
          </Text>
          <Text style={styles.rowValue}>
            {updateStatus.type === 'idle' && (t.currentVersion || '当前版本') + `: v${currentVersion}`}
            {updateStatus.type === 'checking' && '…'}
            {updateStatus.type === 'latest' && (t.currentVersion || '当前版本') + `: v${currentVersion}`}
            {updateStatus.type === 'available' && (t.installUpdate || '点击下载')}
            {updateStatus.type === 'downloading' && (t.checkUpdate || '正在下载…')}
            {updateStatus.type === 'downloaded' && (t.installUpdate || '点击安装')}
            {updateStatus.type === 'error' && updateStatus.message}
          </Text>
        </View>
        {updateStatus.type === 'checking' || updateStatus.type === 'downloading' ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <Text style={styles.rowArrow}>›</Text>
        )}
      </TouchableOpacity>
    );
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
          <Text style={styles.sectionTitle}>应用</Text>

          {renderUpdateRow()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>账户</Text>

          <TouchableOpacity style={styles.row} onPress={() => setShowChangePw(true)}>
            <View style={styles.rowIcon}>
              <LockIcon size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t.changePassword}</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <View style={styles.rowIcon}>
              <Text style={styles.dangerIcon}>🚪</Text>
            </View>
            <Text style={[styles.rowLabel, { color: theme.colors.danger }]}>退出登录</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showChangePw} transparent animationType="fade" onRequestClose={() => { setShowChangePw(false); setPwError(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.changePassword}</Text>

            {pwError && <Text style={styles.modalError}>{pwError}</Text>}

            <TextInput
              style={styles.modalInput}
              placeholder={t.currentPassword}
              placeholderTextColor={theme.colors.textTertiary}
              secureTextEntry
              value={currentPw}
              onChangeText={setCurrentPw}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t.newPassword}
              placeholderTextColor={theme.colors.textTertiary}
              secureTextEntry
              value={newPw}
              onChangeText={setNewPw}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t.confirmNewPassword}
              placeholderTextColor={theme.colors.textTertiary}
              secureTextEntry
              value={confirmPw}
              onChangeText={setConfirmPw}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { setShowChangePw(false); setPwError(null); }}
                disabled={pwLoading}
              >
                <Text style={styles.modalBtnCancelText}>{t.cancel || '取消'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleChangePassword}
                disabled={pwLoading || !currentPw || !newPw || !confirmPw}
              >
                {pwLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>{t.updatePassword || '确认修改'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Change Password Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%', maxWidth: 380,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 24, gap: 16,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '600', color: theme.colors.text,
    textAlign: 'center',
  },
  modalError: {
    fontSize: 13, color: theme.colors.danger,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1, borderColor: theme.colors.borderLight,
    borderRadius: 12, padding: 14, fontSize: 15,
    color: theme.colors.text, backgroundColor: '#f9f9fb',
  },
  modalActions: {
    flexDirection: 'row', gap: 12,
  },
  modalBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: theme.colors.borderLight,
  },
  modalBtnCancelText: {
    fontSize: 15, fontWeight: '500', color: theme.colors.text,
  },
  modalBtnConfirm: {
    backgroundColor: theme.colors.accent,
  },
  modalBtnConfirmText: {
    fontSize: 15, fontWeight: '600', color: '#fff',
  },
});

export default SettingsScreen;
