import { useState } from 'react'
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Pressable, ScrollView,
} from 'react-native'
import { sharesApi } from '../api/shares'
import { useI18n } from '@smart-files/shared/src/i18n'
import type { FileItem } from '../types'
import apiClient from '../api/client'

function ShareFileModal({
  file,
  visible,
  onClose,
}: {
  file: FileItem
  visible: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [expiry, setExpiry] = useState('')
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const shareUrl = shareToken
    ? `${apiClient.defaults.baseURL}/share/${shareToken}`
    : ''

  const expiryOptions = [
    { label: t.oneHour, value: '1h' },
    { label: t.twentyFourHours, value: '24h' },
    { label: t.sevenDays, value: '7d' },
    { label: t.thirtyDays, value: '30d' },
    { label: t.never, value: '' },
  ]

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const result = await sharesApi.createShare(file.id, password || undefined, expiry || undefined)
      setShareToken(result.token)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.shareFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.dialogBox} onPress={() => {}}>
          <ScrollView>
            <Text style={styles.dialogTitle}>{t.shareFile}</Text>
            <Text style={styles.fileName}>{file.name}</Text>

            {!shareToken ? (
              <>
                <Text style={styles.label}>{t.passwordOptional}</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.noPassword}
                  placeholderTextColor="#999"
                  secureTextEntry
                  style={styles.dialogInput}
                />

                <Text style={styles.label}>{t.expiresIn}</Text>
                <View style={styles.expiryRow}>
                  {expiryOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setExpiry(opt.value)}
                      style={[
                        styles.expiryChip,
                        expiry === opt.value && styles.expiryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.expiryChipText,
                          expiry === opt.value && styles.expiryChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {error ? (
                  <Text style={styles.errorText}>{error}</Text>
                ) : null}

                <View style={styles.dialogActions}>
                  <TouchableOpacity onPress={onClose} style={styles.dialogBtn}>
                    <Text style={styles.dialogBtnCancel}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCreate}
                    disabled={loading}
                    style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                  >
                    <Text style={styles.dialogBtnPrimaryText}>
                      {loading ? t.creatingLink : t.createLink}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.linkBox}>
                  <Text style={styles.linkLabel}>{t.shareLinkLabel}</Text>
                  <Text selectable style={styles.linkUrl}>{shareUrl}</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.dialogBtn, styles.dialogBtnPrimary, { alignSelf: 'center', marginTop: 12 }]}
                >
                  <Text style={styles.dialogBtnPrimaryText}>{t.done}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  fileName: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  expiryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  expiryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  expiryChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#e8f0fe',
  },
  expiryChipText: {
    fontSize: 12,
    color: '#666',
  },
  expiryChipTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dialogBtnCancel: {
    fontSize: 15,
    color: '#666',
  },
  dialogBtnPrimary: {
    backgroundColor: '#007AFF',
  },
  dialogBtnPrimaryText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  linkBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  linkLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  linkUrl: {
    fontSize: 13,
    color: '#007AFF',
    fontFamily: 'monospace',
  },
})

export default ShareFileModal
