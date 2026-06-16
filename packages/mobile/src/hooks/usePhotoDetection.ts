import { useState, useEffect, useRef, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'photo_last_sync_timestamp';
const DISMISSED_SESSION_KEY = 'photo_dismissed_this_session';
const SYNCED_ASSET_IDS_KEY = 'synced_asset_ids';
const DEVICE_MODEL_KEY = 'photo_sync_device_model';
const AUTO_SYNC_KEY = 'photo_auto_sync_enabled';

export interface NewPhotoAsset {
  id: string;
  uri: string;
  filename: string;
  mimeType: string;
  creationTime: number;
  width: number;
  height: number;
}

export interface PhotoDetectionResult {
  newPhotos: NewPhotoAsset[];
  count: number;
  isPromptDismissed: boolean;
  permissionGranted: boolean | null;
  isLoading: boolean;
  deviceModel: string | null;
  deviceFolderName: string | null;
  autoSyncEnabled: boolean;
  scan: () => Promise<void>;
  dismissPrompt: () => Promise<void>;
  markSynced: () => Promise<void>;
  markAssetSynced: (assetId: string) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  setAutoSyncEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * Sanitize a string for folder name use: uppercase, keep alphanum and underscore.
 */
function sanitizeSegment(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Detect device model and build folder name like XIAOMI_15_DCIM.
 */
async function detectDeviceModel(): Promise<{ model: string; folderName: string } | null> {
  // Try cached value first
  const cached = await AsyncStorage.getItem(DEVICE_MODEL_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }

  const brand = Device.brand;
  const modelName = Device.modelName;

  if (!brand && !modelName) return null;

  const cleanBrand = sanitizeSegment(brand || '');
  const cleanModel = sanitizeSegment(modelName || '');

  // Build folder name: {BRAND}_{MODEL}_DCIM
  const model = cleanModel ? `${cleanBrand}_${cleanModel}` : cleanBrand;
  const folderName = `${model}_DCIM`;

  const result = { model, folderName };
  await AsyncStorage.setItem(DEVICE_MODEL_KEY, JSON.stringify(result));
  return result;
}

export function usePhotoDetection(): PhotoDetectionResult {
  const [newPhotos, setNewPhotos] = useState<NewPhotoAsset[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{ model: string; folderName: string } | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(true);
  const syncedAssetIdsRef = useRef<Set<string>>(new Set());
  const hasScanned = useRef(false);

  // Check session dismissal state on mount
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_SESSION_KEY).then((val) => {
      if (val === 'true') {
        setIsPromptDismissed(true);
      }
    });
  }, []);

  // Load previously synced asset IDs on mount
  useEffect(() => {
    AsyncStorage.getItem(SYNCED_ASSET_IDS_KEY).then((val) => {
      if (val) {
        try {
          const ids: string[] = JSON.parse(val);
          syncedAssetIdsRef.current = new Set(ids);
        } catch {}
      }
    });
  }, []);

  // Detect device model on mount
  useEffect(() => {
    detectDeviceModel().then(setDeviceInfo);
  }, []);

  // Load auto-sync setting on mount
  useEffect(() => {
    AsyncStorage.getItem(AUTO_SYNC_KEY).then((val) => {
      if (val !== null) {
        setAutoSyncEnabledState(val === 'true');
      }
    });
  }, []);

  // One-time migration: import previously uploaded photo asset IDs
  // from uploaded_photos_tracking (composite `photo_${id}_${timestamp}`)
  // into synced_asset_ids so they don't get re-detected
  useEffect(() => {
    const migrate = async () => {
      const migratedKey = 'synced_asset_ids_migrated_v1';
      const alreadyMigrated = await AsyncStorage.getItem(migratedKey);
      if (alreadyMigrated) return;

      const raw = await AsyncStorage.getItem('uploaded_photos_tracking');
      if (!raw) {
        await AsyncStorage.setItem(migratedKey, '1');
        return;
      }
      try {
        const tracked: { assetId: string; filename: string }[] = JSON.parse(raw);
        const prefix = 'photo_';
        const extractedIds: string[] = [];
        for (const entry of tracked) {
          if (entry.assetId.startsWith(prefix)) {
            // photo_${cameraRollId}_${timestamp} → extract camera roll ID
            const withoutPrefix = entry.assetId.slice(prefix.length);
            const cameraRollId = withoutPrefix.replace(/_\d+$/, '');
            if (cameraRollId) extractedIds.push(cameraRollId);
          }
        }
        if (extractedIds.length > 0) {
          for (const id of extractedIds) {
            syncedAssetIdsRef.current.add(id);
          }
          await AsyncStorage.setItem(
            SYNCED_ASSET_IDS_KEY,
            JSON.stringify([...syncedAssetIdsRef.current]),
          );
        }
      } catch {}
      await AsyncStorage.setItem(migratedKey, '1');
    };
    migrate();
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

      // Map to our simplified type, filtering out already-synced assets
      const newPhotoAssets: NewPhotoAsset[] = assets
        .filter((a) => !syncedAssetIdsRef.current.has(a.id))
        .map((a) => ({
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

  const markAssetSynced = useCallback(async (assetId: string) => {
    syncedAssetIdsRef.current = new Set(syncedAssetIdsRef.current).add(assetId);
    await AsyncStorage.setItem(
      SYNCED_ASSET_IDS_KEY,
      JSON.stringify([...syncedAssetIdsRef.current]),
    );
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
    // Clear individual asset tracking now that timestamp covers everything
    syncedAssetIdsRef.current = new Set();
    await AsyncStorage.removeItem(SYNCED_ASSET_IDS_KEY);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    const granted = status === 'granted';
    setPermissionGranted(granted);
    if (granted && !hasScanned.current) {
      hasScanned.current = true;
      // Only auto-scan if auto-sync is enabled
      const enabled = await AsyncStorage.getItem(AUTO_SYNC_KEY);
      if (enabled === null || enabled === 'true') {
        scan();
      }
    }
    return granted;
  }, [scan]);

  const setAutoSyncEnabled = useCallback(async (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    await AsyncStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
    // When re-enabled, trigger a scan
    if (enabled) {
      await scan();
    }
  }, [scan]);

  return {
    newPhotos,
    count: newPhotos.length,
    isPromptDismissed,
    permissionGranted,
    isLoading,
    deviceModel: deviceInfo?.model ?? null,
    deviceFolderName: deviceInfo?.folderName ?? null,
    autoSyncEnabled,
    scan,
    dismissPrompt,
    markSynced,
    markAssetSynced,
    requestPermission,
    setAutoSyncEnabled,
  };
}

export default usePhotoDetection;
