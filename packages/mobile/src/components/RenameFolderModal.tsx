import { useEffect, useState } from 'react'
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native'
import { useI18n } from '@smart-files/shared/src/i18n'

function RenameFolderModal({
  visible,
  initialName,
  onClose,
  onRename,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  const handleRename = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onRename(trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.dialogBox} onPress={() => {}}>
          <Text style={styles.dialogTitle}>{t.renameFolder}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.folderName}
            placeholderTextColor="#999"
            style={styles.dialogInput}
            autoFocus
            onSubmitEditing={handleRename}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity onPress={onClose} style={styles.dialogBtn}>
              <Text style={styles.dialogBtnCancel}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRename}
              style={[styles.dialogBtn, styles.dialogBtnPrimary]}
            >
              <Text style={styles.dialogBtnPrimaryText}>{t.rename}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
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
})

export default RenameFolderModal
