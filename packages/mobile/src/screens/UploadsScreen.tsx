import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { CloudArrowUpIcon } from '../components/icons';

export function UploadsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>上传</Text>
      </View>
      <View style={styles.empty}>
        <CloudArrowUpIcon size={48} color={theme.colors.textTertiary} />
        <Text style={styles.emptyTitle}>暂无上传任务</Text>
        <Text style={styles.emptySubtitle}>
          在"文件"页选择文件后上传进度会显示在这里
        </Text>
      </View>
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
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, textAlign: 'center' },
});

export default UploadsScreen;
