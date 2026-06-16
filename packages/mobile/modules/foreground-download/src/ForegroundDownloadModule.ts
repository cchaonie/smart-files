import { requireNativeModule } from 'expo-modules-core';

export interface ForegroundDownloadModule {
  /**
   * Start downloading a file with a foreground service.
   * Shows a persistent notification with progress.
   * Download continues even if the app is backgrounded.
   */
  startDownload(url: string, fileName: string): Promise<void>;

  /**
   * Cancel a running download and stop the foreground service.
   */
  cancelDownload(): Promise<void>;

  /**
   * Whether a download is currently in progress.
   */
  isDownloading(): boolean;
}

const module = requireNativeModule('ForegroundDownload') as ForegroundDownloadModule;
export default module;
