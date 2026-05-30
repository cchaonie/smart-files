import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Modal, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView,
} from 'react-native'
import type { FileItem, Folder } from '../types'
import { filesApi } from '../api/files'
import { useI18n } from '@smart-files/shared/src/i18n'

function MoveFileModal({
  file,
  onClose,
  onMoved,
}: {
  file: FileItem;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { t } = useI18n();
  const [modalPath, setModalPath] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const modalParentId =
    modalPath.length === 0 ? null : modalPath[modalPath.length - 1].id;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await filesApi.browse(modalParentId);
      setFolders(data.folders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.failedToLoadFolders);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [modalParentId]);

  useEffect(() => {
    load();
  }, [load]);

  const sameLocation =
    (file.folderId === null && modalParentId === null) ||
    file.folderId === modalParentId;

  async function confirmMove() {
    setErr(null);
    try {
      await filesApi.moveFile(file.id, modalParentId);
      onMoved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.moveFailed);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>{t.cancel}</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{t.moveFileTitle}</Text>
          <TouchableOpacity
            disabled={sameLocation}
            onPress={() => confirmMove()}
          >
            <Text
              style={[
                styles.modalDone,
                sameLocation && styles.modalDoneDisabled,
              ]}
            >
              {t.moveHere}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.moveBreadcrumb}>
          <Text style={styles.moveBreadcrumbLabel}>{t.into}</Text>
          <TouchableOpacity onPress={() => setModalPath([])}>
            <Text style={styles.moveBreadcrumbLink}>{t.root}</Text>
          </TouchableOpacity>
          {modalPath.map((seg, i) => (
            <TouchableOpacity
              key={seg.id}
              onPress={() => setModalPath(modalPath.slice(0, i + 1))}
            >
              <Text style={styles.moveBreadcrumbLink}>
                {' / '}
                {seg.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={folders}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.moveFolderList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={styles.moveFolderRow}
              onPress={() =>
                setModalPath((p) => [...p, { id: f.id, name: f.name }])
              }
            >
              <Text style={styles.moveFolderName}>{f.name}</Text>
              <Text style={styles.moveFolderArrow}>{'>'}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
              <Text style={styles.moveEmpty}>{t.noSubfolders}</Text>
            )
          }
        />

        {err ? (
          <Text style={styles.moveError}>{err}</Text>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCancel: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalDone: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalDoneDisabled: {
    color: '#ccc',
  },
  moveBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  moveBreadcrumbLabel: {
    fontSize: 14,
    color: '#666',
  },
  moveBreadcrumbLink: {
    fontSize: 14,
    color: '#007AFF',
  },
  moveFolderList: {
    paddingVertical: 4,
  },
  moveFolderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  moveFolderName: {
    fontSize: 15,
    color: '#007AFF',
  },
  moveFolderArrow: {
    fontSize: 15,
    color: '#999',
  },
  moveEmpty: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
  },
  moveError: {
    color: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
  },
})

export default MoveFileModal
