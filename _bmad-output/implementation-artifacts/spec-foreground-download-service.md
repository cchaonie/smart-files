# Spec: Android Foreground Service for APK Download

## Summary

Replace the current `expo-file-system` based APK download with an Android foreground service. When user taps "下载更新" in Settings, a persistent notification appears and download continues even if the app is backgrounded.

## Acceptance Criteria

**AC1: Start foreground download**
Given the user is on the Settings screen with an update available
When the user taps "下载更新"
Then an Android foreground service starts
And a persistent notification appears: "正在下载更新… 0%"
And the download continues in the background

**AC2: Progress notification updates**
Given a foreground download is running
When download progresses
Then the notification updates in real-time (e.g. "正在下载更新… 45%")

**AC3: Download completes in background**
Given a foreground download completes
When done
Then the notification updates to "下载完成 — 点击安装"
And tapping the notification triggers APK installation
And a JS event fires back to the SettingsScreen

**AC4: Cancel download**
Given a foreground download is running
When the user cancels via the app UI (or dismisses the notification)
Then the service stops and the notification is removed

**AC5: Survives backgrounding**
Given the user starts a download
When they press home, lock screen, or switch apps
Then the download continues to completion

## Implementation Plan

1. **Expo Module** `modules/foreground-download/`:
   - Package definition + JS interface
   - `ForegroundDownloadModule` (Kotlin) — exposes `startDownload(url, fileName)`, `cancelDownload()`
   - `DownloadService` (Kotlin) — Android foreground service with OkHttp/HttpURLConnection download
   - Notification channel + progress updates + install intent on completion
2. **Config plugin**: Registers service in AndroidManifest.xml
3. **`app.config.js`**: Registers module
4. **`updateService.ts`**: Android uses native module, iOS keeps expo-file-system fallback
