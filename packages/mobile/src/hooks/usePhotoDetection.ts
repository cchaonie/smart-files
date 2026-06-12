import { useState, useEffect, useRef, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'photo_last_sync_timestamp';
const DISMISSED_SESSION_KEY = 'photo_dismissed_this_session';

export interface NewPhotoAsset {
  id: string;
  uri: string;
  filename: string;
  mimeType: string;
  creationTime: number;
  width: number;
  height: number;
}

interface PhotoDetectionResult {
  newPhotos: NewPhotoAsset[];
  count: number;
  isPromptDismissed: boolean;
  permissionGranted: boolean | null;
  isLoading: boolean;
  scan: () => Promise<void>;
  dismissPrompt: () => Promise<void>;
  markSynced: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

/**
 * Hook that scans the device camera roll for untracked photos since the last sync.
 *
 * On mount (when user is logged in), it attempts to scan automatically.
 * The `lastSyncTimestamp` is persisted in AsyncStorage so re-scans only find new photos.
 *
 * Returns:
 *  - newPhotos: array of new photo assets found
 *  - count: number of new photos
 *  - isPromptDismissed: true if user tapped "Later" this session
 *  - permissionGranted: null=not checked, true/false
 *  - isLoading: currently scanning
 *  - scan(): trigger a manual re-scan
 *  - dismissPrompt(): user tapped "Later" — dismisses for this session
 *  - markSynced(): update lastSyncTimestamp to now (after upload completes)
 *  - requestPermission(): request media library permission
 */
export function usePhotoDetection(): PhotoDetectionResult {
  const [newPhotos, setNewPhotos] = useState<NewPhotoAsset[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);
  const hasScanned = useRef(false);

  // Check session dismissal state on mount
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_SESSION_KEY).then((val) => {
      if (val === 'true') {
        setIsPromptDismissed(true);
      }
    });
  }, []);

  const scan = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      // Check permission first
      const { status: currentStatus } = await MediaLibrary.getPermissionsAsync();
      if (currentStatus !== 'granted') {
        setPermissionGranted(false);
        setNewPhotos([]);
        return;
      }
      setPermissionGranted(true);

      // Read last sync timestamp
      const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;

      // Scan camera roll for assets created after last sync
      const assets: MediaLibrary.Asset[] = [];
      let endCursor: string | undefined;
      let hasNextPage = true;

      while (hasNextPage) {
        const page = await MediaLibrary.getAssetsAsync({
          first: 100,
          after: endCursor,
          createdAfter: lastSync || undefined,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: MediaLibrary.SortBy.creationTime,
        });

        assets.push(...page.assets);
        hasNextPage = page.hasNextPage;
        endCursor = page.endCursor;
      }

      // Map to our simplified type
      const newPhotoAssets: NewPhotoAsset[] = assets.map((a) => ({
        id: a.id,
        uri: a.uri,
        filename: a.filename,
        mimeType: a.mediaType === 'photo' ? 'image/jpeg' : a.mediaType,
        creationTime: a.creationTime,
        width: a.width,
        height: a.height,
      }));

      setNewPhotos(newPhotoAssets);
    } catch (error) {
      console.error('Photo detection scan failed:', error);
      setNewPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const dismissPrompt = useCallback(async () => {
    setIsPromptDismissed(true);
    await AsyncStorage.setItem(DISMISSED_SESSION_KEY, 'true');
  }, []);

  const markSynced = useCallback(async () => {
    const now = Date.now();
    // Use the current time minus 60s grace period so we don't miss photos taken during upload
    const syncTimestamp = now - 60_000;
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(syncTimestamp));
    setNewPhotos([]);
    // Reset session dismissal so next session can prompt again
    await AsyncStorage.removeItem(DISMISSED_SESSION_KEY);
    setIsPromptDismissed(false);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    const granted = status === 'granted';
    setPermissionGranted(granted);
    if (granted && !hasScanned.current) {
      hasScanned.current = true;
      scan();
    }
    return granted;
  }, [scan]);

  return {
    newPhotos,
    count: newPhotos.length,
    isPromptDismissed,
    permissionGranted,
    isLoading,
    scan,
    dismissPrompt,
    markSynced,
    requestPermission,
  };
}

export default usePhotoDetection;
