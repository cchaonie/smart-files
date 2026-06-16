import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@smart-files/shared/src/i18n';
import { XMarkIcon, AlbumsIcon, PlusIcon } from '../components/icons';
import { photosApi } from '../api/photos';
import { AlbumPicker } from '../components/AlbumPicker';
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
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);

  // Tag editing state
  const [tags, setTags] = useState<{ tag: string; confidence: number | null }[]>(photo.tags);
  const [newTagText, setNewTagText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Load suggestions when typing
  useEffect(() => {
    if (newTagText.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await photosApi.getTags(newTagText.trim());
        // Filter out tags already on this photo
        const existing = new Set(tags.map(t => t.tag));
        const filtered = res.tags
          .map(t => t.tag)
          .filter(t => !existing.has(t))
          .slice(0, 8);
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch {
        // Silently ignore suggestion fetch errors
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [newTagText, tags]);

  const handleAddTag = useCallback(async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    // Check duplicate locally
    if (tags.some(t => t.tag === trimmed)) {
      Alert.alert('标签已存在', `"${trimmed}" 已存在`);
      return;
    }

    setAddingTag(true);
    setNewTagText('');
    setShowSuggestions(false);
    try {
      await photosApi.addTag(photo.id, trimmed);
      setTags(prev => [...prev, { tag: trimmed, confidence: null }]);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '';
      if (msg.includes('already exists')) {
        Alert.alert('标签已存在', `"${trimmed}" 已存在`);
      } else {
        Alert.alert('添加失败', msg || '请稍后重试');
      }
    } finally {
      setAddingTag(false);
    }
  }, [tags, photo.id]);

  const handleRemoveTag = useCallback(async (tag: string) => {
    setRemovingTag(tag);
    try {
      await photosApi.removeTag(photo.id, tag);
      setTags(prev => prev.filter(t => t.tag !== tag));
    } catch (e: any) {
      Alert.alert('删除失败', e?.response?.data?.message || e?.message || '请稍后重试');
    } finally {
      setRemovingTag(null);
    }
  }, [photo.id]);

  const handleSelectSuggestion = useCallback((tag: string) => {
    handleAddTag(tag);
  }, [handleAddTag]);

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
          source={{ uri: photosApi.previewUrl(photo) }}
          style={styles.previewImage}
          resizeMode="contain"
        />
      </View>

      {/* Metadata & tags */}
      <View style={styles.metaContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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

          {/* Tags — editable */}
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((photoTag, idx) => (
                <View key={`${photoTag.tag}-${idx}`} style={styles.tagPill}>
                  <Text style={styles.tagText}>{photoTag.tag}</Text>
                  <TouchableOpacity
                    style={styles.tagRemoveBtn}
                    onPress={() => handleRemoveTag(photoTag.tag)}
                    disabled={removingTag === photoTag.tag}
                  >
                    {removingTag === photoTag.tag ? (
                      <ActivityIndicator size={10} color="#fff" />
                    ) : (
                      <XMarkIcon size={12} color="#fff" strokeWidth={3} />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add tag input */}
          <View style={styles.addTagRow}>
            <View style={styles.addTagInputWrap}>
              <TextInput
                ref={inputRef}
                style={styles.addTagInput}
                placeholder="添加标签…"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newTagText}
                onChangeText={setNewTagText}
                onSubmitEditing={() => handleAddTag(newTagText)}
                returnKeyType="done"
                editable={!addingTag}
              />
              {/* Autocomplete suggestions */}
              {showSuggestions && (
                <View style={styles.suggestionsList}>
                  {suggestions.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectSuggestion(tag)}
                    >
                      <Text style={styles.suggestionText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.addTagBtn, (!newTagText.trim() || addingTag) && styles.addTagBtnDisabled]}
              onPress={() => handleAddTag(newTagText)}
              disabled={!newTagText.trim() || addingTag}
              activeOpacity={0.7}
            >
              {addingTag ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <PlusIcon size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Add to album */}
          <TouchableOpacity
            style={styles.addToAlbumBtn}
            onPress={() => setShowAlbumPicker(true)}
            activeOpacity={0.7}
          >
            <AlbumsIcon size={16} color="#fff" />
            <Text style={styles.addToAlbumText}>{t.addPhoto}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Album picker */}
      <AlbumPicker
        visible={showAlbumPicker}
        photoId={photo.id}
        onClose={() => setShowAlbumPicker(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  tagText: {
    color: '#fff',
    fontSize: theme.fontSize.sm,
  },
  tagRemoveBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  addTagInputWrap: {
    flex: 1,
    position: 'relative',
  },
  addTagInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: theme.fontSize.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addTagBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagBtnDisabled: {
    opacity: 0.5,
  },
  suggestionsList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#27272a',
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 2,
    zIndex: 50,
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  suggestionText: {
    color: '#e4e4e7',
    fontSize: theme.fontSize.sm,
  },
  addToAlbumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    marginTop: 16,
  },
  addToAlbumText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});

export default PhotoDetailScreen;
