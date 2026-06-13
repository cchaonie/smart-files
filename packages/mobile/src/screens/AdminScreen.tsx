import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export function AdminScreen() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = await authApi.getToken();
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleResetPassword = useCallback(async (user: AdminUser) => {
    Alert.alert(
      t.admin?.confirmReset || '确认重置该用户密码？',
      `${user.email}`,
      [
        { text: t.cancel || '取消', style: 'cancel' },
        {
          text: t.admin?.resetPassword || '重置密码',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const token = await authApi.getToken();
              const response = await fetch(`/api/admin/users/${user.id}/reset-password`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (!response.ok) throw new Error('Reset failed');
              const data = await response.json();
              Alert.alert(
                t.admin?.passwordReset || '密码已重置',
                `${t.admin?.tempPassword || '临时密码'}: ${data.temporaryPassword}`
              );
            } catch (error) {
              Alert.alert(t.error || '错误', '重置密码失败');
            } finally {
              setActionLoading(false);
              setModalVisible(false);
            }
          },
        },
      ]
    );
  }, [t]);

  const handleChangeRole = useCallback(async (user: AdminUser, newRole: string) => {
    Alert.alert(
      t.admin?.confirmRoleChange || '确认变更该用户角色？',
      `${user.email} → ${newRole === 'admin' ? (t.admin?.admin || '管理员') : (t.admin?.user || '普通用户')}`,
      [
        { text: t.cancel || '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            try {
              setActionLoading(true);
              const token = await authApi.getToken();
              const response = await fetch(`/api/admin/users/${user.id}/role`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role: newRole }),
              });
              if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Change role failed');
              }
              await fetchUsers();
            } catch (error: any) {
              if (error.message === 'Cannot remove the last admin') {
                Alert.alert(t.error || '错误', t.admin?.noAdmins || '不能移除最后一个管理员');
              } else {
                Alert.alert(t.error || '错误', '变更角色失败');
              }
            } finally {
              setActionLoading(false);
              setModalVisible(false);
            }
          },
        },
      ]
    );
  }, [t, fetchUsers]);

  const openUserActions = useCallback((user: AdminUser) => {
    setSelectedUser(user);
    setModalVisible(true);
  }, []);

  const renderUserItem = useCallback(({ item }: { item: AdminUser }) => {
    const isAdmin = item.role === 'admin';
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => openUserActions(item)}
        activeOpacity={0.6}
      >
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || item.email}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={[styles.roleBadge, isAdmin ? styles.adminBadge : styles.userBadge]}>
          <Text style={[styles.roleText, isAdmin ? styles.adminRoleText : styles.userRoleText]}>
            {isAdmin ? (t.admin?.admin || '管理员') : (t.admin?.user || '普通用户')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [t, openUserActions]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.admin?.title || '管理'}</Text>
        <Text style={styles.subtitle}>
          {t.admin?.users || '用户管理'} · {users.length}
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedUser && (
              <>
                <Text style={styles.modalTitle}>{selectedUser.name || selectedUser.email}</Text>
                <Text style={styles.modalEmail}>{selectedUser.email}</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.resetButton]}
                    onPress={() => handleResetPassword(selectedUser)}
                    disabled={actionLoading}
                  >
                    <Text style={styles.modalButtonText}>
                      {t.admin?.resetPassword || '重置密码'}
                    </Text>
                  </TouchableOpacity>
                  {selectedUser.role === 'admin' ? (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.demoteButton]}
                      onPress={() => handleChangeRole(selectedUser, 'user')}
                      disabled={actionLoading}
                    >
                      <Text style={styles.modalButtonText}>
                        {t.admin?.changeRole || '变更角色'} → {t.admin?.user || '普通用户'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.promoteButton]}
                      onPress={() => handleChangeRole(selectedUser, 'admin')}
                      disabled={actionLoading}
                    >
                      <Text style={styles.modalButtonText}>
                        {t.admin?.changeRole || '变更角色'} → {t.admin?.admin || '管理员'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>{t.cancel || '取消'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {actionLoading && (
              <ActivityIndicator size="small" color={theme.colors.accent} style={styles.modalLoader} />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize['3xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
  },
  adminBadge: {
    backgroundColor: theme.colors.accent + '20',
  },
  userBadge: {
    backgroundColor: theme.colors.textTertiary + '20',
  },
  roleText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  adminRoleText: {
    color: theme.colors.accent,
  },
  userRoleText: {
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  modalEmail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  modalActions: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  modalButton: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: theme.colors.danger,
  },
  demoteButton: {
    backgroundColor: theme.colors.warning || '#f59e0b',
  },
  promoteButton: {
    backgroundColor: theme.colors.accent,
  },
  cancelButton: {
    backgroundColor: theme.colors.border,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  modalLoader: {
    marginTop: theme.spacing.md,
  },
});

export default AdminScreen;
