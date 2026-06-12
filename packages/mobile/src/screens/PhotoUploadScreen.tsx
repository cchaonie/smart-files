import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { XMarkIcon, ArrowPathIcon } from '../components/icons';
import type { PhotoUploadItem } from '../hooks/usePhotoUpload';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PhotoUpload'>;

function statusIcon(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'uploading': return '⬆️';
    case 'done': return '✅';
    case 'error': return '❌';
    default: return '❓';
  }
}

export function PhotoUploadScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const items: PhotoUploadItem[] = route.params?.items ?? [];
  const isUploading = route.params?.isUploading ?? false;

  const totalDone = items.filter((i) => i.status === 'done').length;
  const totalFailed = items.filter((i) => i.status === 'error').length;
  const allComplete =
    items.length > 0 &&
    items.every((i) => i.status === 'done' || i.status === 'error');

  const renderItem = ({ item }: { item: PhotoUploadItem }) => (
    <View style={styles.item}>
      <Text style={styles.itemIcon}>{statusIcon(item.status)}</Text>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.filename}</Text>
        {item.status === 'uploading' && (
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${item.progress}%` }]} />
          </View>
        )}
        {item.status === 'error' && item.error ? (
          <Text style={styles.errorText} numberOfLines={1}>{item.error}</Text>
        ) : null}
      </View>
      <Text style={styles.itemProgress}>
        {item.status === 'uploading' ? `${item.progress}%` : item.status === 'done' ? '100%' : ''}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <XMarkIcon size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>照片上传</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          总计 {items.length} 张 · 完成 {totalDone} 张
          {totalFailed > 0 ? ` · 失败 ${totalFailed} 张` : ''}
        </Text>
      </View>

      {/* Upload list */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无上传任务</Text>
          </View>
        }
      />

      {/* Bottom bar */}
      {allComplete ? (
        <View style={styles.bottomBar}>
          {totalFailed > 0 ? (
            <TouchableOpacity style={[styles.bottomBtn, styles.retryBtn]}>
              <ArrowPathIcon size={16} color={theme.colors.danger} />
              <Text style={styles.retryBtnText}>重试失败 ({totalFailed})</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.bottomBtn, styles.doneBtn]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneBtnText}>
              {totalFailed > 0 ? '关闭' : '完成 ✓'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : isUploading ? (
        <View style={styles.bottomBar}>
          <Text style={styles.uploadingText}>上传中...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  headerBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  headerSpacer: { width: 28 },

  summary: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: theme.colors.zinc50,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  summaryText: { fontSize: 14, color: theme.colors.textSecondary },

  list: { paddingVertical: 8 },

  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  itemIcon: { fontSize: 20, marginRight: 10 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, color: theme.colors.text },
  itemProgress: {
    fontSize: 12, color: theme.colors.textTertiary,
    marginLeft: 8, minWidth: 36, textAlign: 'right',
  },
  progressBarBg: { height: 4, backgroundColor: theme.colors.border, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: 2 },
  errorText: { fontSize: 11, color: theme.colors.danger, marginTop: 2 },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: theme.colors.textTertiary },

  bottomBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.zinc50,
  },
  bottomBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: theme.radii.lg,
  },
  retryBtn: {
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5',
  },
  retryBtnText: { color: theme.colors.danger, fontSize: 14, fontWeight: '500' },
  doneBtn: { backgroundColor: theme.colors.accent },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  uploadingText: {
    flex: 1, textAlign: 'center', fontSize: 14,
    color: theme.colors.accent, paddingVertical: 12,
  },
});

export default PhotoUploadScreen;
