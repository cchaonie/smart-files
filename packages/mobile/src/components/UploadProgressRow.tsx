import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { UploadProgress } from '../types'
import { useI18n } from '@smart-files/shared/src/i18n'

function UploadProgressRow({
  item,
  onRetry,
}: {
  item: UploadProgress;
  onRetry: (id: number) => void;
}) {
  const { t } = useI18n();
  const label =
    item.status === 'done'
      ? t.done
      : item.status === 'error'
        ? t.error
        : item.status === 'uploading'
          ? t.uploading
          : t.pending;

  const barColor =
    item.status === 'error'
      ? '#ef4444'
      : item.status === 'done'
        ? '#22c55e'
        : '#3b82f6';

  return (
    <View style={styles.uploadItem}>
      <View style={styles.uploadItemHeader}>
        <Text style={styles.uploadItemLabel} numberOfLines={1}>
          {label}
          {' · '}
          {item.name}
        </Text>
        {(item.status === 'uploading' || item.status === 'done') && (
          <Text style={styles.uploadItemPercent}>{item.progress}%</Text>
        )}
      </View>
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${item.progress}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      {item.error ? (
        <View style={styles.uploadErrorRow}>
          <Text style={styles.uploadErrorText} numberOfLines={1}>
            {item.error}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => onRetry(item.id)}
          >
            <Text style={styles.retryBtnText}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  uploadItem: {
    marginBottom: 10,
  },
  uploadItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  uploadItemLabel: {
    fontSize: 12,
    color: '#555',
    flex: 1,
    marginRight: 8,
  },
  uploadItemPercent: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  uploadErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  uploadErrorText: {
    fontSize: 11,
    color: '#ef4444',
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  retryBtnText: {
    fontSize: 11,
    color: '#ef4444',
  },
})

export default UploadProgressRow
