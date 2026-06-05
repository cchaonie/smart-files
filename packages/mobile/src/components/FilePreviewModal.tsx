import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { filesApi } from '../api/files'
import { useI18n } from '@smart-files/shared/src/i18n'
import type { FileItem } from '../types'

function isPreviewableImage(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith('image/')) return true
  const ext = name.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')
}

function isPreviewableVideo(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith('video/')) return true
  const ext = name.split('.').pop()?.toLowerCase()
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '')
}

function isPreviewableAudio(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith('audio/')) return true
  const ext = name.split('.').pop()?.toLowerCase()
  return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext || '')
}

function formatBytes(n: bigint): string {
  if (n < 1024n) return `${n} B`
  const kb = 1024n
  const mb = kb * kb
  const gb = mb * kb
  if (n < mb) return `${(Number(n) / Number(kb)).toFixed(1)} KB`
  if (n < gb) return `${(Number(n) / Number(mb)).toFixed(1)} MB`
  return `${(Number(n) / Number(gb)).toFixed(2)} GB`
}

function FilePreviewModal({
  file,
  visible,
  onClose,
  onOpenExternal,
}: {
  file: FileItem
  visible: boolean
  onClose: () => void
  onOpenExternal: (url: string) => void
}) {
  const { t } = useI18n()
  const url = filesApi.previewUrl(file.id)
  const isImg = isPreviewableImage(file.mimeType, file.name)
  const isVid = isPreviewableVideo(file.mimeType, file.name)
  const isAud = isPreviewableAudio(file.mimeType, file.name)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Content */}
        <Pressable style={styles.content} onPress={() => {}}>
          {/* Preview area */}
          {isImg ? (
            <Image
              source={{ uri: url }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewIcon}>
                {isVid ? '🎬' : isAud ? '🎵' : '📄'}
              </Text>
              <Text style={styles.previewType}>
                {isVid ? t.video : isAud ? t.audio : t.file}
              </Text>
            </View>
          )}

          {/* File info */}
          <View style={styles.infoSection}>
            <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
            <Text style={styles.fileMeta}>
              {formatBytes(BigInt(file.size))}
              {' · '}
              {file.mimeType || t.file}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {!isImg && (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => onOpenExternal(url)}
              >
                <Text style={styles.btnPrimaryText}>
                  {isVid ? t.play : isAud ? t.play : t.openFile}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
              <Text style={styles.btnSecondaryText}>{t.close}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewImage: {
    width: '100%',
    height: '55%',
    borderRadius: 12,
  },
  previewPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  previewType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  infoSection: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  fileMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  actions: {
    marginTop: 28,
    gap: 10,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#007AFF',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  btnSecondaryText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
})

export default FilePreviewModal
