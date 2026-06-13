import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@smart-files/shared/src/i18n';
import { XMarkIcon } from '../components/icons';
import { theme } from '../theme';
import type { Photo } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = 1024;
  const mb = kb * kb;
  const gb = mb * kb;
  if (bytes < mb) return `${(bytes / kb).toFixed(1)} KB`;
  if (bytes < gb) return `${(bytes / mb).toFixed(1)} MB`;
  return `${(bytes / gb).toFixed(2)} GB`;
}

interface PhotoDetailScreenProps {
  photo: Photo;
  onClose: () => void;
}

export function PhotoDetailScreen({ photo, onClose }: PhotoDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View style={styles.overlay}>
      {/* Close button */}
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 12 }]}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <XMarkIcon size={24} color="#fff" />
      </TouchableOpacity>

      {/* Preview image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: photo.previewPath }}
          style={styles.previewImage}
          resizeMode="contain"
        />
      </View>

      {/* Metadata */}
      <View style={styles.metaContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {photo.capturedAt ? (
            <Text style={styles.metaText}>
              {t.mobileCaptured}: {new Date(photo.capturedAt).toLocaleString()}
            </Text>
          ) : null}
          {photo.width && photo.height ? (
            <Text style={styles.metaText}>
              {t.mobileDimensions}: {photo.width} × {photo.height}
            </Text>
          ) : null}
          <Text style={styles.metaText}>
            {formatBytes(photo.fileSize)}
          </Text>

          {/* Tags */}
          {photo.tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {photo.tags.map((photoTag, idx) => (
                <View key={idx} style={styles.tagPill}>
                  <Text style={styles.tagText}>{photoTag.tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 100,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
  },
  metaContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  metaText: {
    color: '#e4e4e7',
    fontSize: theme.fontSize.md,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagPill: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: '#fff',
    fontSize: theme.fontSize.sm,
  },
});

export default PhotoDetailScreen;
