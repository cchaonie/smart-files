import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { filesApi } from '../api/files';
import { browse } from '../api/browse';
import { FileItem, Folder } from '../types';
import { useAuth } from '../context/AuthContext';

export function HomeScreen() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [path, setPath] = useState<{ id: string | null; name: string }[]>([]);
  const { logout } = useAuth();

  const currentFolderId = path.length > 0 ? path[path.length - 1].id : null;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await browse(currentFolderId);
      setFolders(data.folders);
      setFiles(data.files);
    } catch (error) {
      Alert.alert('Error', 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentFolderId]);

  const handleFolderPress = (folder: Folder) => {
    setPath([...path, { id: folder.id, name: folder.name }]);
  };

  const handleBack = () => {
    setPath(path.slice(0, -1));
  };

  const handleDeleteFile = async (fileId: string) => {
    Alert.alert(
      'Delete File',
      'Are you sure you want to delete this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await filesApi.deleteFile(fileId);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete file');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: FileItem | Folder }) => {
    if ('mimeType' in item) {
      // It's a file
      return (
        <TouchableOpacity
          style={styles.item}
          onLongPress={() => handleDeleteFile(item.id)}
        >
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSize}>{formatBytes(BigInt(item.size))}</Text>
        </TouchableOpacity>
      );
    } else {
      // It's a folder
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => handleFolderPress(item)}
        >
          <Text style={styles.folderName}>📁 {item.name}</Text>
        </TouchableOpacity>
      );
    }
  };

  const data = [...folders, ...files];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Files</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      {path.length > 0 && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text>← Back to {path[path.length - 2]?.name || 'Root'}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No files in this folder</Text>
        }
      />
    </View>
  );
}

function formatBytes(n: bigint): string {
  if (n < 1024n) return `${n} B`;
  const kb = 1024n;
  const mb = kb * kb;
  const gb = mb * kb;
  if (n < mb) return `${(Number(n) / Number(kb)).toFixed(1)} KB`;
  if (n < gb) return `${(Number(n) / Number(mb)).toFixed(1)} MB`;
  return `${(Number(n) / Number(gb)).toFixed(2)} GB`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  logout: {
    color: '#007AFF',
    fontSize: 16,
  },
  backButton: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemName: {
    fontSize: 16,
    marginBottom: 4,
  },
  itemSize: {
    fontSize: 12,
    color: '#666',
  },
  folderName: {
    fontSize: 16,
    color: '#007AFF',
  },
  empty: {
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
  },
});
