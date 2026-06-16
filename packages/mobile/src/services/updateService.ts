import { Platform, Linking } from 'react-native';
import { createDownloadResumable, getContentUriAsync, cacheDirectory } from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Native foreground download module (Android only)
let foregroundDownloadModule: any = null;
try {
  foregroundDownloadModule = require('../../modules/foreground-download').default;
} catch {
  // Not available — will use expo-file-system fallback
}

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
  | { status: 'foreground'; progress: number }
  | { status: 'error'; message: string };

// Type for the progress callback used by native module
type ProgressCallback = (bytesWritten: number, bytesTotal: number) => void;
type CompleteCallback = (localPath: string) => void;
type ErrorCallback = (message: string) => void;
type CancelCallback = () => void;

let onProgressCallback: ProgressCallback | null = null;
let onCompleteCallback: CompleteCallback | null = null;
let onErrorCallback: ErrorCallback | null = null;
let onCancelCallback: CancelCallback | null = null;

/**
 * Get the currently running app version from app config.
 * Falls back to '0.0.20' if unavailable.
 */
export function getCurrentVersion(): string {
  const manifest = Constants.expoConfig as any;
  return manifest?.version || '0.0.20';
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
 * Download the APK — uses Android foreground service on Android,
 * falls back to expo-file-system on iOS.
 *
 * @param url  Download URL for the APK
 * @param onProgress  Called with (bytesWritten, bytesTotal) for progress tracking
 * @param onComplete  Called with the local file path when done
 * @param onError  Called with error message on failure
 * @param onCancel  Called when download is cancelled (e.g. via notification dismiss)
 * @returns  The local file path (iOS) or undefined (Android, async via callback)
 */
export async function downloadApk(
  url: string,
  onProgress?: ProgressCallback,
  onComplete?: CompleteCallback,
  onError?: ErrorCallback,
  onCancel?: CancelCallback,
): Promise<string | undefined> {
  // Android: use native foreground service
  if (Platform.OS === 'android' && foregroundDownloadModule) {
    return downloadApkWithForegroundService(
      url,
      onProgress ?? null,
      onComplete ?? null,
      onError ?? null,
      onCancel ?? null,
    );
  }

  // iOS / fallback: use expo-file-system
  return downloadApkWithFileSystem(url, onProgress ?? null);
}

/**
 * Start foreground service download on Android.
 * The download continues even if the app is backgrounded.
 * File path is returned via onComplete callback, not as return value.
 */
async function downloadApkWithForegroundService(
  url: string,
  onProgress: ProgressCallback | null,
  onComplete: CompleteCallback | null,
  onError: ErrorCallback | null,
  onCancel: CancelCallback | null,
): Promise<undefined> {
  const filename = `smart-files-${Date.now()}.apk`;

  onProgressCallback = onProgress;
  onCompleteCallback = onComplete;
  onErrorCallback = onError;
  onCancelCallback = onCancel;

  // Start the foreground service
  await foregroundDownloadModule.startDownload(url, filename);

  return undefined;
}

/**
 * Cancel a running foreground service download.
 */
export async function cancelDownload(): Promise<void> {
  if (Platform.OS === 'android' && foregroundDownloadModule) {
    await foregroundDownloadModule.cancelDownload();
  }
  onCancelCallback?.();
}

/**
 * Download using expo-file-system (iOS fallback).
 */
async function downloadApkWithFileSystem(
  url: string,
  onProgress: ProgressCallback | null,
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
      if (onProgress) {
        onProgress(
          downloadProgress.totalBytesWritten,
          downloadProgress.totalBytesExpectedToWrite,
        );
      }
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
 * Uses IntentLauncher to start ACTION_VIEW with the content URI.
 */
export async function installApk(localPath: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('APK installation is only supported on Android');
  }

  // Convert file:// URI to content:// URI via FileProvider
  const contentUri = await getContentUriAsync(localPath);

  // Open with package installer using explicit Intent flags
  const IntentLauncher = require('expo-intent-launcher');
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
