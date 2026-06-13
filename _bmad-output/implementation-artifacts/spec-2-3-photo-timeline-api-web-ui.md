---
title: 'Story 2.3: Photo Timeline API + Web UI'
type: 'feature'
created: '2026-06-13'
status: 'done'
baseline_commit: '70595b2'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Photos are uploaded, thumbnailed, and tagged, but users have no way to browse them. There is no photo timeline — users must use the file manager which lacks date-based grouping, thumbnail grids, and photo-specific preview.

**Approach:** Add a paginated `/api/photos` GET endpoint returning photos sorted by capturedAt DESC, grouped by day; and a React PhotosPage with an infinite-scroll thumbnail grid, month headers, a photo detail viewer with metadata/tags, and a month/year quick-scroll date picker.

## Boundaries & Constraints

**Always:**
- GET `/api/photos` accepts query params `cursor` (photo id of last item from previous page — cursor-based pagination) and `limit` (default 20, max 100). Returns `{ photos: PhotoWithTags[], nextCursor: string | null, total: number }`.
- Response photos include: `id, thumbnailPath (URL), previewPath (URL), originalName, width, height, fileSize, mimeType, capturedAt, status, tags[]` where each tag is `{ tag: string, confidence: number | null }`.
- `thumbnailPath` / `previewPath` stored as relative paths (e.g., `.thumbnails/user/2026/06/id_grid.webp`) — serve via an endpoint `/api/photos/:id/thumbnail` and `/api/photos/:id/preview` that reads from disk and streams the file. The web client constructs `<img src="/api/photos/${id}/thumbnail" />`.
- Photos sorted by `capturedAt DESC NULLS LAST` (photos without EXIF date fall to end), then by `createdAt DESC` as tiebreaker.
- GET `/api/photos/:id` returns full photo detail with all tags.
- The web PhotosPage lives at `/photos` route under AppLayout (with bottom tabs).
- PhotosPage shows a 3-column thumbnail grid (responsive: 2 cols on small screens, 4 cols on wide).
- Month headers displayed as sticky headers (e.g., "2026年6月") separating day groups.
- Each day group shows a day label ("6月13日 星期六") above its photos.
- Infinite scroll: IntersectionObserver triggers `loadMore` when sentinel element enters viewport.
- Photo viewer opens as a modal overlay when tapping a thumbnail — shows the 1200px preview JPEG, photo metadata (captured date, file size, dimensions, tags), with a close button and swipe-to-dismiss.
- Tags shown as pills under the photo in the detail view.
- Month/year quick-scroll: a small floating button on the timeline triggers a scrollable month/year picker overlay — tapping a month scrolls the timeline to the first photo from that month.
- Loading state: skeleton shimmer grid matching the column count.
- Empty state: "暂无照片" with a subtle illustration or icon.
- Error state: retry button with error message.
- All i18n keys added to both zh-CN.ts and en.ts + I18nStrings type.
- Backend uses `strictNullChecks: false`.
- No new Prisma models or migrations.

**Ask First:**
- (None — all patterns match existing code.)

**Never:**
- No changes to upload flow, thumbnail pipeline, or AI tagging.
- No server-side rendering — client fetches data via API.
- No photo deletion or editing in this story (read-only timeline).
- No state management beyond React hooks and context.
- No changes to the mobile Expo app.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path — user has 50 photos | GET /api/photos?limit=20 | First 20 photos returned, ordered by capturedAt DESC, with tags, nextCursor set | N/A |
| Second page | GET /api/photos?cursor=<lastId>&limit=20 | Next 20 photos; nextCursor is null when no more | N/A |
| No photos | User just registered, 0 photos | Empty array, nextCursor null, total 0 | N/A |
| Photos without EXIF data | capturedAt is null | Photos appear at end of list sorted by createdAt DESC | N/A |
| Thumbnail file missing from disk | GET /api/photos/:id/thumbnail returns 404 | Broken image icon in grid | Log error, return 404 |
| Photo detail with tags | GET /api/photos/:id | Full photo record + tags array returned | N/A |
| Very large user (10,000+ photos) | Cursor pagination with limit=100 | Each page returns ≤100 photos; scroll performance maintained via lazy rendering | N/A |
| Network error on web | Fetch fails | Error state shown with retry button | React catch + setError |
| Scroll to bottom | Sentinel enters viewport | loadMore fires, next page fetched, appended to grid | On error, show retry at bottom |

</frozen-after-approval>

## Code Map

- `packages/backend/src/photos/photos.controller.ts` — ADD GET `/photos` and GET `/photos/:id` and GET `/photos/:id/thumbnail` and GET `/photos/:id/preview`
- `packages/backend/src/photos/photos.service.ts` — ADD `list(userId, cursor?, limit?)` and `findById(photoId, userId)` methods; add `getThumbnailStream(photoId)` and `getPreviewStream(photoId)` for file serving
- `packages/web/src/types/index.ts` — ADD `PhotoTag`, `Photo`, `PhotoTimelineResponse` interfaces
- `packages/web/src/api/photos.ts` — NEW: photosApi with `list(cursor?, limit?)` and `getById(id)`
- `packages/web/src/components/icons.tsx` — ADD `ImageIcon` SVG component
- `packages/web/src/components/BottomTabs.tsx` — ADD Photos tab linking to `/photos`
- `packages/web/src/pages/PhotosPage.tsx` — NEW: Timeline with infinite scroll grid, date groups, sticky month headers, skeleton loading, empty/error states, quick-scroll date picker
- `packages/web/src/pages/PhotoDetailPage.tsx` — NEW: Modal photo viewer with preview image, metadata, tags
- `packages/web/src/App.tsx` — ADD `/photos` route under AppLayout
- `packages/shared/src/i18n/types.ts` — ADD photo-related i18n keys
- `packages/shared/src/i18n/zh-CN.ts` — ADD Chinese photo translations
- `packages/shared/src/i18n/en.ts` — ADD English photo translations

## Tasks & Acceptance

**Execution:**
- [x] `packages/backend/src/photos/photos.controller.ts` — ADD GET `/photos`, `/photos/:id`, `/photos/:id/thumbnail`, `/photos/:id/preview` endpoints
- [x] `packages/backend/src/photos/photos.service.ts` — ADD `list()`, `findById()`, `getThumbnailStream()`, `getPreviewStream()` methods
- [x] `packages/web/src/types/index.ts` — ADD `Photo`, `PhotoTag`, `PhotoTimelineResponse` types
- [x] `packages/web/src/api/photos.ts` — NEW: photosApi with `list()` and `getById()`
- [x] `packages/web/src/components/icons.tsx` — ADD `ImageIcon` SVG (image/camera icon)
- [x] `packages/web/src/components/BottomTabs.tsx` — ADD photos tab to tabs array
- [x] `packages/web/src/pages/PhotosPage.tsx` — NEW: full timeline page with infinite scroll, date grouping, skeleton, empty/error states, quick-scroll date picker
- [x] `packages/web/src/pages/PhotoDetailPage.tsx` — NEW: modal photo viewer overlay
- [x] `packages/web/src/App.tsx` — ADD `/photos` route under AppLayout
- [x] `packages/shared/src/i18n/types.ts` — ADD timeline/photo keys
- [x] `packages/shared/src/i18n/zh-CN.ts` — ADD Chinese translations
- [x] `packages/shared/src/i18n/en.ts` — ADD English translations

**Acceptance Criteria:**
- Given a user with photos, when they navigate to `/photos`, then the timeline loads with thumbnails in reverse-chronological order grouped by day with month headers
- Given the user scrolls to the bottom, when the sentinel triggers, then the next page of photos is appended
- Given a photo has tags, when the user taps a thumbnail, then the photo detail modal opens showing the preview image, metadata, and tag pills
- Given no photos exist, when the user visits `/photos`, then the empty state "暂无照片" is shown
- Given a fetch fails, when the error occurs, then an error message with a retry button is shown
- Given the user taps the date picker button, when they select a month, then the timeline scrolls to the first photo from that month
- Given TypeScript compilation, when running `tsc --noEmit` from both packages/backend/ and packages/web/, then zero errors

## Spec Change Log

| Iteration | Finding | Change | Bad-state avoided | KEEP |
|-----------|---------|--------|-------------------|------|
| 1 | Blind/edge: parseInt NaN crash | Added BadRequestException for non-numeric limit | Backend crash on malformed input | Input validation pattern |
| 1 | Blind/edge: Path traversal risk | Added `.startsWith(this.photoRoot)` validation | Unauthorized file read outside pool | Path sanitization guard |
| 1 | Blind: Cursor not user-scoped | Added `userId` filter to cursor lookup | Metadata leak of other users' photo timestamps | Ownership guards on all lookups |
| 1 | Blind/edge: Cursor drops same-timestamp photos | Added `id` tiebreaker to OR conditions + `orderBy: { id: 'desc' }` | Some photos silently disappear from pagination | Composite cursor with unique tiebreaker |
| 1 | Blind/edge: Silent cursor failure (missing photo) | Throw NotFoundException instead of returning page 1 | Duplicate photos / pagination reset | Validate cursor before using it |
| 1 | Blind/edge: Stream ENOENT → 500 | Added `fs.access()` check before `createReadStream` | Missing file returns proper 404 | Pre-check disk state |
| 1 | Edge: Hardcoded `/mnt/pool` | Changed to `this.photoRoot` | Breaks when PHOTO_ROOT configured differently | Use ConfigService everywhere |
| 1 | Edge: Concurrent scroll (frontend) | Added `fetchingRef` concurrency lock | Duplicate photos in grid | Debounce/lock pattern for infinite scroll |
| 1 | Edge: Observer stale closure | Stored `loadMore` in `useRef` | Re-created observer on every pagination | Stable ref pattern for callback deps |
| 1 | Edge: Broken images for PROCESSING/FAILED | Filter by status in render + onError handlers | Broken image icons in grid | Graceful degradation for async states |
| 1 | Edge: 4-col grid missing | Added `lg:grid-cols-4` | Different from spec layout | Match spec exactly |
| 1 | Edge: Date picker hardcoded Chinese | Replaced with i18n key `jumpToMonth` | Bilingual UI consistency | All UI text through i18n |
| 1 | Edge: End-of-list message wrong | Changed from `noPhotos` to `endOfList` key | Wrong semantics | Separate state-specific messages |


## Design Notes

**Backend response shape:**
```typescript
// GET /api/photos?cursor=<id>&limit=20
{
  "photos": [
    {
      "id": "uuid",
      "thumbnailPath": "/api/photos/uuid/thumbnail",
      "previewPath": "/api/photos/uuid/preview",
      "originalName": "IMG_001.jpg",
      "width": 3024,
      "height": 4032,
      "fileSize": 4097152,
      "mimeType": "image/jpeg",
      "capturedAt": "2026-06-10T14:30:00.000Z",
      "status": "READY",
      "tags": [
        { "tag": "宝宝", "confidence": 0.92 },
        { "tag": "户外", "confidence": 0.45 }
      ]
    }
  ],
  "nextCursor": "uuid-of-last-item",
  "total": 150
}
```

**Web date grouping logic (in PhotosPage):**
- Group photos array by `YYYY-MM` (month) then `YYYY-MM-DD` (day).
- Render: `<StickyMonthHeader>2026年6月</StickyMonthHeader>` → `<DayGroup label="6月13日 星期六">` → grid of thumbnails.
- `useMemo` for grouping computation to avoid re-render on scroll.

**Thumbnail serving:**
- Controller reads the relative `thumbnailPath`/`previewPath` from the Photo record, resolves against PHOTO_ROOT's parent dir (since paths start with `.thumbnails/`), and streams via `res.createReadStream()`.
- Uses NestJS `@Res()` with `stream.Writable` passthrough — simpler than a static middleware since thumbnails are sub-path under the pool.

## Verification

**Commands:**
- `cd /home/chrisnie/Code/smart-files/packages/backend && npx tsc --noEmit` — expected: zero errors
- `cd /home/chrisnie/Code/smart-files/packages/web && npx tsc --noEmit` — expected: zero errors
- `cd /home/chrisnie/Code/smart-files && npx tsc --noEmit --project packages/backend/tsconfig.json` — expected: zero errors

**Manual checks:**
- Start backend, GET `/api/photos` with auth token — verify paginated response with correct structure
- Start web, navigate to `/photos` — verify timeline renders, scrolls, and modal opens

## Suggested Review Order

**Cursor pagination & timeline API**

- Entry point: paginated list with composite cursor (capturedAt + id tiebreaker), user-scoped, validated
  [`photos.service.ts:152`](../../../packages/backend/src/photos/photos.service.ts#L152)

- Ownership-verified photo detail endpoint
  [`photos.service.ts:213`](../../../packages/backend/src/photos/photos.service.ts#L213)

- Thumbnail/preview streaming with access check + path traversal guard
  [`photos.service.ts:245`](../../../packages/backend/src/photos/photos.service.ts#L245)

- Controller wiring: input validation + 4 GET endpoints
  [`photos.controller.ts:57`](../../../packages/backend/src/photos/photos.controller.ts#L57)

**Timeline UI**

- Main timeline page: infinite scroll, skeleton, empty/error, month/day grouping, date picker
  [`PhotosPage.tsx:128`](../../../packages/web/src/pages/PhotosPage.tsx#L128)

- Photo detail modal overlay: preview, metadata, tags, error fallback
  [`PhotoDetailPage.tsx:16`](../../../packages/web/src/pages/PhotoDetailPage.tsx#L16)

- API module connecting frontend to backend pagination
  [`photos.ts:1`](../../../packages/web/src/api/photos.ts#L1)

- Bottom tabs nav — Photos tab added as second tab
  [`BottomTabs.tsx:8`](../../../packages/web/src/components/BottomTabs.tsx#L8)

**Supporting changes**

- Frontend types for Photo, PhotoTag, PhotoTimelineResponse
  [`index.ts:80`](../../../packages/web/src/types/index.ts#L80)

- Route registration under AppLayout
  [`App.tsx:75`](../../../packages/web/src/App.tsx#L75)

- I18n keys: photos, noPhotos, jumpToMonth, endOfList, captured, dimensions
  [`types.ts:68`](../../../packages/shared/src/i18n/types.ts#L68)

- Chinese translations for all new keys
  [`zh-CN.ts:115`](../../../packages/shared/src/i18n/zh-CN.ts#L115)

- English translations for all new keys
  [`en.ts:115`](../../../packages/shared/src/i18n/en.ts#L115)
