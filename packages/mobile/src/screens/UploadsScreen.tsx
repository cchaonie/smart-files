import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { theme } from '../theme';
import { CloudArrowUpIcon, TrashIcon } from '../components/icons';
import { useUploadContext, type UploadItem } from '../context/UploadContext';

function statusConfig(status: string) {
  switch (status) {
    case 'pending':
      return { label: '排队中', color: '#71717a', bg: '#f4f4f5' };
    case 'uploading':
      return { label: '上传中', color: '#2563eb', bg: '#eff6ff' };
    case 'done':
      return { label: '完成', color: '#16a34a', bg: '#f0fdf4' };
    case 'error':
      return { label: '失败', color: '#dc2626', bg: '#fef2f2' };
    default:
      return { label: '?', color: '#71717a', bg: '#f4f4f5' };
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function UploadItemCard({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry,
}: {
  item: UploadItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const cfg = statusConfig(item.status);
  const clampedProgress = Math.max(0, Math.min(100, item.progress ?? 0));

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardIcon}>
          <CloudArrowUpIcon size={20} color={theme.colors.textTertiary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.filename || '未命名文件'}
          </Text>
          {item.error && (
            <Text style={styles.cardError} numberOfLines={1}>
              {item.error}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
      </View>

      {/* Progress bar for uploading */}
      {item.status === 'uploading' && (
        <View style={styles.progressSection}>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${clampedProgress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{clampedProgress}%</Text>
        </View>
      )}

      {/* Action buttons */}
      {item.status !== 'done' && (
        <View style={styles.cardActions}>
          {item.status === 'uploading' && (
            <TouchableOpacity style={styles.actionBtn} onPress={onPause}>
              <Text style={styles.actionBtnText}>⏸</Text>
            </TouchableOpacity>
          )}
          {item.status === 'error' && (
            <TouchableOpacity style={styles.actionBtn} onPress={onRetry}>
              <Text style={styles.actionBtnText}>↻</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={onCancel}
          >
            <Text style={[styles.actionBtnText, { color: theme.colors.danger }]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function UploadsScreen() {
  const {
    items,
    isUploading,
    clearCompleted,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    pauseAll,
    resumeAll,
    cancelAll,
    retryFailed,
  } = useUploadContext();

  const totalDone = items.filter(i => i.status === 'done').length;
  const totalFailed = items.filter(i => i.status === 'error').length;
  const totalActive = items.filter(
    i => i.status === 'pending' || i.status === 'uploading',
  ).length;
  const hasItems = items.length > 0;
  const allComplete =
    hasItems && items.every(i => i.status === 'done' || i.status === 'error');
  const hasActive = items.some(
    i => i.status === 'pending' || i.status === 'uploading',
  );

  const renderItem = ({ item }: { item: UploadItem }) => (
    <UploadItemCard
      item={item}
      onPause={() => pauseUpload(item.id)}
      onResume={() => resumeUpload(item.id)}
      onCancel={() => cancelUpload(item.id)}
      onRetry={() => retryUpload(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>上传</Text>
        {hasItems && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {totalDone}/{items.length}
            </Text>
          </View>
        )}
      </View>

      {/* Global action bar */}
      {hasItems && !allComplete && (
        <View style={styles.actionBar}>
          {hasActive && (
            <TouchableOpacity style={styles.actionBarBtn} onPress={pauseAll}>
              <Text style={styles.actionBarBtnText}>⏸ 全部暂停</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBarBtn, styles.actionBarCancelBtn]}
            onPress={cancelAll}
          >
            <Text
              style={[styles.actionBarBtnText, { color: theme.colors.danger }]}
            >
              ✕ 全部取消
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {hasItems ? (
        <>
          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {isUploading
                ? `上传中 ${totalActive} · 完成 ${totalDone}${totalFailed > 0 ? ` · 失败 ${totalFailed}` : ''}`
                : `总计 ${items.length} · 完成 ${totalDone}${totalFailed > 0 ? ` · 失败 ${totalFailed}` : ''}`}
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
            {allComplete ? (
              <View style={styles.bottomRow}>
                {totalFailed > 0 && (
                  <TouchableOpacity
                    style={styles.retryAllBtn}
                    onPress={retryFailed}
                  >
                    <Text style={styles.retryAllBtnText}>↻ 重试失败</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={clearCompleted}
                >
                  <Text style={styles.clearBtnText}>清除完成项</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <CloudArrowUpIcon size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyTitle}>暂无上传任务</Text>
          <Text style={styles.emptySubtitle}>在"文件"页选择文件后上传</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: { fontSize: 22, fontWeight: '600', color: theme.colors.text },
  headerBadge: {
    backgroundColor: theme.colors.accentGlow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.accent,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.zinc50,
  },
  actionBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.sm,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBarCancelBtn: { borderColor: '#fecaca' },
  actionBarBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },

  summary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.zinc50,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  summaryText: { fontSize: 13, color: theme.colors.textSecondary },

  list: { paddingVertical: 4 },

  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.zinc100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
  cardError: { fontSize: 11, color: theme.colors.danger, marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.full,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },

  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    minWidth: 32,
    textAlign: 'right',
  },

  cardActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.zinc100,
  },
  cancelBtn: { backgroundColor: '#fef2f2' },
  actionBtnText: { fontSize: 13, color: theme.colors.textSecondary },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.zinc50,
  },
  bottomRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  retryAllBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.zinc100,
  },
  retryAllBtnText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.zinc100,
  },
  clearBtnText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
});

export default UploadsScreen;
