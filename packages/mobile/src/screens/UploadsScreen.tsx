import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { CloudArrowUpIcon, TrashIcon, CheckCircleIcon } from '../components/icons';
import { usePhotoUploadContext } from '../context/PhotoUploadContext';

function statusIcon(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'uploading': return '⬆️';
    case 'done': return '✅';
    case 'error': return '❌';
    default: return '❓';
  }
}

export function UploadsScreen() {
  const {
    items, isUploading, uploadedPhotos,
    isCleaningUp, cleanupResult, clearCompleted,
    cleanupCompletedPhotos, dismissCleanupResult,
  } = usePhotoUploadContext();

  const totalDone = items.filter(i => i.status === 'done').length;
  const totalFailed = items.filter(i => i.status === 'error').length;
  const totalActive = items.filter(i => i.status === 'pending' || i.status === 'uploading').length;
  const hasItems = items.length > 0;
  const allComplete = hasItems && items.every(i => i.status === 'done' || i.status === 'error');
  const canCleanup = allComplete && totalDone > 0;

  const renderItem = ({ item }: { item: typeof items[0] }) => (
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

  // Cleanup result view
  if (cleanupResult) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>上传</Text>
        </View>
        <View style={styles.cleanupResult}>
          {cleanupResult.failed === 0 ? (
            <>
              <CheckCircleIcon size={48} color={theme.colors.success} />
              <Text style={styles.cleanupTitle}>清理完成</Text>
              <Text style={styles.cleanupDesc}>
                已删除 {cleanupResult.success} 张本地照片，释放了手机存储空间
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.cleanupIcon}>⚠️</Text>
              <Text style={styles.cleanupTitle}>部分删除失败</Text>
              <Text style={styles.cleanupDesc}>
                成功 {cleanupResult.success} 张，失败 {cleanupResult.failed} 张
              </Text>
              {cleanupResult.errors.map((err, i) => (
                <Text key={i} style={styles.cleanupError} numberOfLines={1}>{err}</Text>
              ))}
            </>
          )}
          <TouchableOpacity style={styles.cleanupDoneBtn} onPress={dismissCleanupResult}>
            <Text style={styles.cleanupDoneText}>确定</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>上传</Text>
        {hasItems && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              完成 {totalDone}/{items.length}
            </Text>
          </View>
        )}
      </View>

      {hasItems ? (
        <>
          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {isUploading
                ? `上传中 ${totalActive} 项 · 已完成 ${totalDone}${totalFailed > 0 ? ` · 失败 ${totalFailed}` : ''}`
                : `总计 ${items.length} 项 · 完成 ${totalDone}${totalFailed > 0 ? ` · 失败 ${totalFailed}` : ''}`}
            </Text>
          </View>

          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />

          {/* Bottom bar */}
          <View style={styles.bottomBar}>
            {isCleaningUp ? (
              <View style={styles.cleaningUpRow}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={styles.cleaningUpText}>正在删除本地照片...</Text>
              </View>
            ) : canCleanup ? (
              <>
                <TouchableOpacity
                  style={[styles.bottomBtn, styles.cleanupBtn]}
                  onPress={cleanupCompletedPhotos}
                >
                  <TrashIcon size={16} color="#fff" />
                  <Text style={styles.cleanupBtnText}>
                    删除本地副本 ({totalDone} 张)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={clearCompleted}>
                  <Text style={styles.skipBtnText}>跳过</Text>
                </TouchableOpacity>
              </>
            ) : allComplete ? (
              <TouchableOpacity style={styles.clearBtn} onPress={clearCompleted}>
                <Text style={styles.clearBtnText}>清除完成项</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <CloudArrowUpIcon size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyTitle}>暂无上传任务</Text>
          <Text style={styles.emptySubtitle}>
            在"文件"页选择照片或文件后上传
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: { fontSize: 22, fontWeight: '600', color: theme.colors.text },
  headerBadge: {
    backgroundColor: theme.colors.accentGlow,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.full,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '500', color: theme.colors.accent },

  summary: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: theme.colors.zinc50,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  summaryText: { fontSize: 13, color: theme.colors.textSecondary },

  list: { paddingVertical: 4 },

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

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, textAlign: 'center' },

  bottomBar: {
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.zinc50,
  },
  bottomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: theme.radii.lg,
  },
  cleanupBtn: { backgroundColor: theme.colors.accent },
  cleanupBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { fontSize: 13, color: theme.colors.textTertiary },
  clearBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.zinc100, alignSelf: 'center',
  },
  clearBtnText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },

  // Cleanup result
  cleanupResult: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
  },
  cleanupTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.text },
  cleanupDesc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  cleanupIcon: { fontSize: 48 },
  cleanupError: { fontSize: 12, color: theme.colors.danger, maxWidth: '80%' },
  cleanupDoneBtn: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: theme.radii.lg, backgroundColor: theme.colors.accent,
  },
  cleanupDoneText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Cleaning up
  cleaningUpRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
  },
  cleaningUpText: { fontSize: 14, color: theme.colors.accent },
});

export default UploadsScreen;
