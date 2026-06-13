---
title: 'Story 2.5: Mobile Photo Timeline — Expo Screens'
type: 'feature'
created: '2026-06-13'
status: 'done'
baseline_commit: '03cbc68'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Photos are uploaded, thumbnailed, tagged, and browsable on the web, but mobile users still have no way to view their NAS photo library from the app. They can only upload photos but cannot browse what's already stored.

**Approach:** Add a Photo Timeline screen and a Photo Detail screen to the Expo mobile app, reusing the existing `GET /api/photos` endpoint (cursor-based pagination) and thumbnail/preview streaming endpoints built in Story 2.3. No backend changes needed.

## Boundaries & Constraints

**Always:**
- New screen `PhotoTimelineScreen` — shows photos in reverse-chronological order with thumbnails in a FlatList (3 columns).
- Infinite scroll via FlatList's `onEndReached` — calls `photosApi.list()` with cursor for next page. Append results.
- Thumbnails rendered with `Image` component pointing to `GET /api/photos/:id/thumbnail` URL.
- Photo thumbnail has `loading="lazy"` equivalent — handled by FlatList's built-in recycling.
- Tapping a photo opens `PhotoDetailScreen` as a modal or navigates to it with the photo data passed as route params.
- `PhotoDetailScreen` — full-screen preview (1200px JPEG) via `Image` with `resizeMode="contain"`, displays metadata (captured date, file size, dimensions), and tags as chips.
- Tags shown below the photo as small blue pills with confidence percentage.
- Add `'photos'` to `TabKey` type in BottomTabs and wire it into App.tsx's `renderScreen()`.
- The existing mobile `photosApi.list()` currently uses page-based pagination with a different response shape — UPDATE it to match the real backend's cursor-based pagination (`GET /api/photos?cursor=&limit=20` returns `{ photos: Photo[], nextCursor, total }`).
- Add proper `Photo` and `PhotoTimelineResponse` types to mobile types.
- Loading state: ActivityIndicator overlay during initial load.
- Empty state: icon + "暂无照片" text.
- Error state: error message + retry button.
- Use existing `theme` design system (zinc palette + cobalt accent, consistent with web).
- All new strings must use i18n — add mobile-relevant keys to both zh-CN and en locale files.
- No backend changes of any kind — the API already exists from Story 2.3.

**Ask First:**
- (None — all patterns match existing mobile code.)

**Never:**
- No backend changes.
- No new API endpoints.
- No changes to upload, thumbnail, or AI tagging pipelines.
- No changes to web frontend.
- No new npm dependencies beyond what's already in mobile/package.json.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path — photos exist | Open Photos tab | Grid of thumbnails loads, newest first | N/A |
| Scroll to bottom | onEndReached fires | Next page loads and appends to grid | N/A |
| No photos | Empty library | Empty state with icon + "暂无照片" | N/A |
| Network error | Fetch fails | Error message + retry button | Try/catch, setError state |
| Tap thumbnail | User taps a photo | PhotoDetailScreen opens with full preview | N/A |
| Photo has tags | Detail screen opens | Tag pills shown under photo | N/A |
| Photo missing thumbnail | GET returns 404 | FlatList renders placeholder/empty cell | N/A |
| All photos loaded | nextCursor is null | No more fetches on scroll | N/A |

</frozen-after-approval>

## Code Map

- `packages/mobile/src/types/index.ts` — ADD `Photo`, `PhotoTag`, `PhotoTimelineResponse` interfaces; ADD `TabKey` gets 'photos' added
- `packages/mobile/src/api/photos.ts` — UPDATE `list()` to use cursor-based pagination matching real backend; ADD `getById()` method
- `packages/mobile/src/components/BottomTabs.tsx` — ADD 'photos' tab with PhotosIcon
- `packages/mobile/src/screens/PhotoTimelineScreen.tsx` — NEW: FlatList with 3-column thumbnail grid, infinite scroll, loading/error/empty states
- `packages/mobile/src/screens/PhotoDetailScreen.tsx` — NEW: Full-screen photo viewer with metadata and tags
- `packages/mobile/App.tsx` — ADD PhotoTimelineScreen import; ADD `'photos'` case to `renderScreen()`; ADD PhotosIcon import
- `packages/shared/src/i18n/types.ts` — ADD mobile photo i18n keys
- `packages/shared/src/i18n/zh-CN.ts` — ADD Chinese translations
- `packages/shared/src/i18n/en.ts` — ADD English translations

## Tasks & Acceptance

**Execution:**
- [x] `packages/mobile/src/types/index.ts` — ADD `Photo`, `PhotoTag`, `PhotoTimelineResponse` interfaces
- [x] `packages/mobile/src/api/photos.ts` — UPDATE `list()` to cursor-based pagination; ADD `getById()`
- [x] `packages/mobile/src/components/BottomTabs.tsx` — ADD 'photos' tab with PhotosIcon; ADD 'photos' to TabKey
- [x] `packages/mobile/src/screens/PhotoTimelineScreen.tsx` — NEW: Expo screen with FlatList grid, infinite scroll, states
- [x] `packages/mobile/src/screens/PhotoDetailScreen.tsx` — NEW: Full-screen photo viewer modal
- [x] `packages/mobile/App.tsx` — ADD PhotoTimelineScreen import; ADD 'photos' case to renderScreen
- [x] `packages/shared/src/i18n/types.ts` — ADD mobile photo i18n keys
- [x] `packages/shared/src/i18n/zh-CN.ts` — ADD Chinese translations
- [x] `packages/shared/src/i18n/en.ts` — ADD English translations

**Acceptance Criteria:**
- Given mobile user opens Photos tab, then photo timeline loads with thumbnails in reverse-chronological order
- Given user scrolls to bottom, then next page of photos loads and appends to grid
- Given user taps a photo thumbnail, then full-screen preview opens with metadata and tags
- Given no photos exist, then empty state is shown
- Given fetch fails, then error message with retry button is shown
- Given TypeScript compilation, when running tsc --noEmit from packages/mobile/, then zero errors

## Spec Change Log


## Design Notes

**Mobile FlatList grid pattern:**
Expo's FlatList with `numColumns={3}` creates the grid. Each item is a square thumbnail. The data comes from `photosApi.list()` which now returns cursor-based results. Store `photos`, `cursor`, `hasMore`, `loading`, `error` state in the screen component.

**API update:**
The existing `photosApi.list()` uses page-based pagination with response shape `{ data: PhotoListItem[], total, page }`. Update to match Story 2.3's backend:
```typescript
list: async (cursor?: string, limit: number = 20): Promise<PhotoTimelineResponse> => {
  const params: Record<string, string | number> = { limit };
  if (cursor) params.cursor = cursor;
  const res = await apiClient.get('/photos', { params });
  return res.data;
}
```

**Navigation pattern:**
Use `useState<Photo | null>` for selected photo, similar to how web does it. When selected, render `PhotoDetailScreen` as an absolute-positioned overlay. This avoids adding React Navigation stack complexity.

## Verification

**Commands:**
- `cd /home/chrisnie/Code/smart-files/packages/mobile && npx tsc --noEmit` — expected: zero errors

**Manual checks:**
- Run Expo app, navigate to Photos tab — verify timeline renders
- Tap a photo — verify detail screen opens with preview + metadata + tags
