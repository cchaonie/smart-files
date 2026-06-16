import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface PhotoUploadPromptProps {
  count: number;
  isLoading: boolean;
  deviceFolderName: string | null;
  onUpload: () => void;
  onLater: () => void;
}

export function PhotoUploadPrompt({
  count,
  isLoading,
  deviceFolderName,
  onUpload,
  onLater,
}: PhotoUploadPromptProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (count === 0) return null;

  // Step 1: Show detection result
  if (!showConfirm) {
    return (
      <View style={styles.container}>
        <View style={styles.banner}>
          <Text style={styles.icon}>📸</Text>
          <View style={styles.content}>
            <Text style={styles.title}>
              发现 {count} 张新照片
            </Text>
            <Text style={styles.subtitle}>
              上传到 NAS 以释放手机空间
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              if (deviceFolderName) {
                setShowConfirm(true);
              } else {
                onUpload();
              }
            }}
            disabled={isLoading}
          >
            <Text style={styles.btnPrimaryText}>
              {isLoading ? '扫描中...' : '同步'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={onLater}
            disabled={isLoading}
          >
            <Text style={styles.btnSecondaryText}>稍后</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 2: Show folder confirmation
  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.icon}>📁</Text>
        <View style={styles.content}>
          <Text style={styles.title}>
            确认同步文件夹
          </Text>
          <Text style={styles.subtitle}>
            照片将同步到以下文件夹
          </Text>
        </View>
      </View>

      <View style={styles.folderPreview}>
        <Text style={styles.folderName}>
          {deviceFolderName}
        </Text>
        <Text style={styles.folderHint}>
          {count} 张照片将上传到此文件夹
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={onUpload}
        >
          <Text style={styles.btnPrimaryText}>确认同步</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => setShowConfirm(false)}
        >
          <Text style={styles.btnSecondaryText}>取消</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    overflow: 'hidden',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
  subtitle: {
    fontSize: 13,
    color: '#0ea5e9',
    marginTop: 2,
  },
  folderPreview: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    alignItems: 'center',
  },
  folderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  folderHint: {
    fontSize: 12,
    color: '#0ea5e9',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#0284c7',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#e0f2fe',
  },
  btnSecondaryText: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PhotoUploadPrompt;
