# Story 1.5: Android Photo Detection & Upload

## Overview

As an **Android user**, I want the app to detect new photos in my camera roll and prompt me to upload them to the NAS, so that I don't have to manually select and upload each photo.

**Status:** ✅ Implementation Complete

## Acceptance Criteria

| Given | When | Then |
|-------|------|------|
| User opens the app | App scans camera roll for untracked photos since last sync | New photos are detected and counted |
| 5 new photos found | User sees in-app prompt | "发现 N 张新照片 上传到NAS以释放手机空间" with Upload / Later |
| User taps Upload | Photos begin transferring | PhotoUploadScreen opens with real-time progress |
| 0 new photos | App launches | No prompt is shown |
| User taps Later | Prompt dismissed | Not re-prompted during this session |
| App is sent to background mid-upload | User switches apps | Upload continues (sequential upload, no interruption) |

## Architecture

```
packages/mobile/src/
├── api/
│   └── photos.ts                   ← Photo upload API client (multipart/form-data via XHR)
├── hooks/
│   ├── usePhotoDetection.ts        ← Camera roll scan via expo-media-library
│   └── usePhotoUpload.ts           ← Batch upload with progress tracking + notifications
├── components/
│   └── PhotoUploadPrompt.tsx       ← "发现 N 张新照片" banner component
├── screens/
│   ├── PhotoUploadScreen.tsx       ← Upload progress screen with per-item status
│   └── HomeScreen.tsx              ← Updated: integrates photo detection + prompt
└── App.tsx                         ← Updated: added PhotoUpload route
```

## Flow

1. **App Launch** → `HomeScreen` renders → `usePhotoDetection` checks `MediaLibrary` permission → requests if needed
2. **Permission granted** → scans camera roll assets with `createdAfter >= lastSyncTimestamp`
3. **New photos found** → `PhotoUploadPrompt` banner appears below action bar (Upload / Later)
4. **User taps Upload** → navigates to `PhotoUploadScreen` → `usePhotoUpload` starts sequential upload via `POST /api/photos/upload`
5. **Upload completes** → `expo-notifications` fires completion notification → `markSynced()` updates `lastSyncTimestamp`
6. **User taps Later** → stores `photo_dismissed_this_session = true` in AsyncStorage → no re-prompt this session

## Key Components

### `usePhotoDetection()`
- **Permission**: Auto-requests `expo-media-library` access on user login
- **Scan**: Paginated (100 per page) query of all photos since `photo_last_sync_timestamp`
- **Performance**: Only scans on `requestPermission()` — no background polling in v1
- **Storage**: `lastSyncTimestamp` persisted in AsyncStorage, updated after successful upload batch

### `usePhotoUpload()`
- **Strategy**: Sequential upload (one photo at a time) to avoid overwhelming the NAS
- **Transport**: XMLHttpRequest with `FormData` + progress tracking
- **Notification**: `expo-notifications` shows completion count on finish
- **Edge cases**: Abort support, per-item error tracking

### `PhotoUploadScreen`
- Per-photo status indicator (⏳ pending / ⬆️ uploading / ✅ done / ❌ error)
- Progress bar per actively uploading item
- Summary bar: "总计 N 张 · 完成 M 张 · 失败 K 张"
- Bottom action bar on completion: retry failed / clear done / close

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-media-library` | SDK 54 | Camera roll access |
| `expo-notifications` | SDK 54 | Upload completion notifications |
| `expo-task-manager` | SDK 54 | Background task support (future use) |
| `expo-background-fetch` | SDK 54 | Background fetch support (future use) |

## Limitations (v1)

- **No foreground service**: True Android foreground service (persistent notification during upload) requires `expo-dev-client` + bare workflow. In v1, uploads continue while the app is in the foreground; if backgrounded, the React Native JS thread may be suspended. Future improvement: add `expo-task-manager` based background upload.
- **No periodic scan**: Scanning only happens on app launch. Background periodic scanning requires `expo-background-fetch` or WorkManager integration.
- **Sequential upload**: Photos upload one at a time. Parallel upload can be added in a future story.

## Testing

- Manual: Run on Android device → grant media permission → camera roll scanned → prompt shown → upload tested
- No automated UI tests for Expo in this project (Expo + Jest with RNTL not set up)
