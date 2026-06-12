import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { PhotoUploadItem } from '../hooks/usePhotoUpload';

interface PhotoUploadScreenProps {
  items?: PhotoUploadItem[];
  isUploading?: boolean;
  onRetry?: () => void;
  onClear?: () => void;
  onDone?: () => void;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'uploading':
      return '⬆️';
    case 'done':
      return '✅';
    case 'error':
      return '❌';
    default:
      return '❓';
  }
}

export function PhotoUploadScreen({
  items = [],
  isUploading = false,
  onRetry,
  onClear,
  onDone,
}: PhotoUploadScreenProps) {
  const navigation = useNavigation();
  const totalDone = items.filter((i) => i.status === 'done').length;
  const totalFailed = items.filter((i) => i.status === 'error').length;
  const allComplete =
    items.length > 0 &&
    items.every((i) => i.status === 'done' || i.status === 'error');

  const renderItem = ({ item }: { item: PhotoUploadItem }) => (
    <View style={styles.item}>
      <Text style={styles.itemIcon}>{statusIcon(item.status)}</Text>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.filename}
        </Text>
        {item.status === 'uploading' && (
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${item.progress}%` }]}
            />
          </View>
        )}
        {item.status === 'error' && item.error ? (
          <Text style={styles.errorText} numberOfLines={1}>
            {item.error}
          </Text>
        ) : null}
      </View>
      <Text style={styles.itemProgress}>
        {item.status === 'uploading'
          ? `${item.progress}%`
          : item.status === 'done'
            ? '100%'
            : ''}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← 返回</Text>
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
          {totalFailed > 0 && onRetry ? (
            <TouchableOpacity
              style={[styles.bottomBtn, styles.retryBtn]}
              onPress={onRetry}
            >
              <Text style={styles.retryBtnText}>
                重试失败 ({totalFailed})
              </Text>
            </TouchableOpacity>
          ) : null}
          {onClear && totalDone > 0 ? (
            <TouchableOpacity
              style={[styles.bottomBtn, styles.clearBtn]}
              onPress={onClear}
            >
              <Text style={styles.clearBtnText}>清除完成项</Text>
            </TouchableOpacity>
          ) : null}
          {onDone ? (
            <TouchableOpacity
              style={[styles.bottomBtn, styles.doneBtn]}
              onPress={onDone}
            >
              <Text style={styles.doneBtnText}>
                {totalFailed > 0 ? '关闭' : '完成 ✓'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.bottomBtn, styles.doneBtn]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneBtnText}>关闭</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : isUploading ? (
        <View style={styles.bottomBar}>
          <Text style={styles.uploadingText}>上传中...</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60, // Balance the back button width
  },
  summary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
  },
  itemProgress: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    minWidth: 36,
    textAlign: 'right',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 2,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 2,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  retryBtnText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  clearBtn: {
    backgroundColor: '#f0f0f0',
  },
  clearBtnText: {
    color: '#666',
    fontSize: 14,
  },
  doneBtn: {
    backgroundColor: '#0284c7',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadingText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#0284c7',
    paddingVertical: 12,
  },
});

export default PhotoUploadScreen;
