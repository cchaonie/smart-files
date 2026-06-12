import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { CloudArrowUpIcon, ArrowPathIcon } from '../components/icons';
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
  const { items, isUploading, clearCompleted } = usePhotoUploadContext();

  const totalDone = items.filter(i => i.status === 'done').length;
  const totalFailed = items.filter(i => i.status === 'error').length;
  const totalActive = items.filter(i => i.status === 'pending' || i.status === 'uploading').length;
  const hasItems = items.length > 0;
  const allComplete = hasItems && items.every(i => i.status === 'done' || i.status === 'error');

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
              {totalActive > 0
                ? `上传中 ${totalActive} 项 · 已完成 ${totalDone} · 失败 ${totalFailed}`
                : `总计 ${items.length} 项 · 完成 ${totalDone}${totalFailed > 0 ? ` · 失败 ${totalFailed}` : ''}`}
            </Text>
          </View>

          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />

          {/* Bottom action */}
          {allComplete && (
            <View style={styles.bottomBar}>
              {totalDone > 0 && (
                <TouchableOpacity style={styles.clearBtn} onPress={clearCompleted}>
                  <Text style={styles.clearBtnText}>清除已完成</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      ) : (
        <View style={styles.empty}>
          <CloudArrowUpIcon size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyTitle}>暂无上传任务</Text>
          <Text style={styles.emptySubtitle}>
            检测到新照片后自动上传，进度会显示在这里
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
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.zinc50,
  },
  clearBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.zinc100,
  },
  clearBtnText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
});

export default UploadsScreen;
