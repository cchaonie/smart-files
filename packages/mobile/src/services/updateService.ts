import { Platform, Linking } from 'react-native';
import {
  cacheDirectory,
  createDownloadResumable,
  getContentUriAsync,
} from 'expo-file-system/build/legacy/FileSystem';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GITHUB_OWNER = 'cchaonie';
const GITHUB_REPO = 'smart-files';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const DOWNLOAD_KEY = 'update_apk_path';

/** Compare two semver strings. Returns 1 if a > b, -1 if a < b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  downloadUrl: string | null;
  releaseNotes: string;
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'latest'; currentVersion: string }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'downloading'; progress: number }
  | { status: 'downloaded'; localPath: string }
  | { status: 'error'; message: string };

/**
 * Get the currently running app version from app config.
 * Falls back to '1.0.0' if unavailable.
 */
export function getCurrentVersion(): string {
  const manifest = Constants.expoConfig as any;
  return manifest?.version || '1.0.0';
}

/**
 * Check for a newer version on GitHub Releases.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const response = await fetch(GITHUB_API, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  const latestTag: string = data.tag_name || '';
  const latestVersion = latestTag.replace(/^v/, '');
  const currentVersion = getCurrentVersion();

  // Find APK asset
  const assets: Array<{ name: string; browser_download_url: string }> = data.assets || [];
  const apkAsset = assets.find((a) => a.name.endsWith('.apk'));

  return {
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    latestVersion,
    downloadUrl: apkAsset?.browser_download_url || null,
    releaseNotes: data.body || '',
  };
}

/**
 * Download the APK to a local path with progress callback.
 * Returns the local file URI.
 */
export async function downloadApk(
  url: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const filename = `smart-files-${Date.now()}.apk`;
  const localPath = `${cacheDirectory}${filename}`;

  const downloadResumable = createDownloadResumable(
    url,
    localPath,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesExpectedToWrite > 0
          ? Math.round(
              (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100,
            )
          : 0;
      onProgress?.(progress);
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Download failed: no file URI returned');
  }

  return result.uri;
}

/**
 * Save the downloaded APK path for later installation.
 */
export async function saveDownloadedPath(localPath: string): Promise<void> {
  await AsyncStorage.setItem(DOWNLOAD_KEY, localPath);
}

/**
 * Get the previously downloaded APK path, if any.
 */
export async function getSavedDownloadedPath(): Promise<string | null> {
  return AsyncStorage.getItem(DOWNLOAD_KEY);
}

/**
 * Clear the saved download path.
 */
export async function clearDownloadedPath(): Promise<void> {
  await AsyncStorage.removeItem(DOWNLOAD_KEY);
}

/**
 * Install the downloaded APK by opening it with the system package installer.
 * On Android we use IntentLauncher; fallback to Linking.openURL.
 */
export async function installApk(localPath: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('APK installation is only supported on Android');
  }

  // Convert file:// URI to content:// URI via FileProvider
  const contentUri = await getContentUriAsync(localPath);

  // Open the content URI with the package installer
  try {
    const IntentLauncher = require('expo-intent-launcher');
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch {
    // Fallback: try Linking.openURL
    await Linking.openURL(contentUri);
  }
}
