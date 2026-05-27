import { Modal, Image, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import type { FileItem } from '../types'
import { filesApi } from '../api/files'
import { useI18n } from '@smart-files/shared/src/i18n'

function ImagePreviewModal({
  file,
  onClose,
}: {
  file: FileItem;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.previewOverlay} onPress={onClose}>
        <Pressable style={styles.previewContent} onPress={() => {}}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={onClose}>
            <Text style={styles.previewCloseText}>{t.close}</Text>
          </TouchableOpacity>
          <Image
            source={{ uri: filesApi.previewUrl(file.id) }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  previewCloseText: {
    color: '#fff',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
})

export default ImagePreviewModal
