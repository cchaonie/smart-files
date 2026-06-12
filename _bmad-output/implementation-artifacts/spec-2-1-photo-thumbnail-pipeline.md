---
title: 'Story 2.1: Photo Thumbnail Pipeline — Sharp + BullMQ'
type: 'feature'
created: '2026-06-12'
status: 'done'
baseline_commit: '2c8dece'
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Photos are uploaded with status `PROCESSING` and thumbnail jobs are enqueued, but no worker exists to generate thumbnails. Users see processing spinners indefinitely.

**Approach:** Create a BullMQ worker (`PhotoThumbnailWorker`) that calls a `ThumbnailService` using Sharp to generate 320px WebP grid thumbnails and 1200px JPEG previews, updates Photo records, and chains to the AI tagging queue. Add a retry endpoint for failed photos.

## Boundaries & Constraints

**Always:**
- Thumbnails stored at `/mnt/pool/.thumbnails/{user}/{YYYY}/{MM}/{id}_grid.webp` and `{id}_preview.jpg`
- Photo status chain: `PROCESSING → READY` (success) or `PROCESSING → FAILED` (after 3 retries)
- On success: update `thumbnailPath`, `previewPath`, `width`, `height`, then enqueue `ai-tagging` job
- On failure after 3 retries: set `FAILED`, clean up any partial files
- Worker runs in BullMQ queue `photo-thumbnail` (already registered in PhotosModule)
- Backend uses `strictNullChecks: false` — no type assertions needed for null fields

**Ask First:**
- Should the ThumbnailService live in a separate `thumbnail/` module or stay inside `photos/`? (Proposed: inside `photos/` for now, co-located with the module that owns the queue)

**Never:**
- No new Prisma migrations (schema already has required fields)
- No changes to PhotosController upload endpoint (it already enqueues the job)
- No changes to the upload pipeline or file storage logic

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Photo with status PROCESSING, valid image file | 320px WebP + 1200px JPEG generated, status → READY, ai-tagging job enqueued | N/A |
| Corrupt image | Photo with status PROCESSING, invalid/corrupt file | Worker fails, BullMQ retries (3x), then status → FAILED, partial files cleaned up | Throw error from worker — BullMQ handles retry count |
| Photo not found | Job with photoId that doesn't exist in DB | Worker throws error, BullMQ retries (3x), then job moves to failed queue | Log error, no DB update |
| Missing source file | Photo record exists but file deleted from disk | Worker throws Sharp error, retries → FAILED | Same as corrupt image path |
| Retry on FAILED photo | POST /api/photos/:id/retry with FAILED status | Photo status reset to PROCESSING, new job enqueued | 404 if photo not found; 409 if not FAILED |
| Small image (< 320px) | Tiny image uploaded | Thumbnail generated with `withoutEnlargement: true` — no upscaling | N/A — Sharp handles gracefully |
| Large RAW file (50MB+) | High-resolution file | Sharp streams via pipeline, memory stays bounded | Sharp's built-in streaming handles |

</frozen-after-approval>

## Code Map

- `packages/backend/src/photos/thumbnail.service.ts` — NEW: Sharp thumbnail generation
- `packages/backend/src/photos/photo-thumbnail.worker.ts` — NEW: BullMQ worker
- `packages/backend/src/photos/photos.module.ts` — Register ThumbnailService + worker as providers
- `packages/backend/src/photos/photos.controller.ts` — Add POST /:id/retry endpoint
- `packages/backend/src/photos/photos.service.ts` — Add retry() method

## Tasks & Acceptance

**Execution:**
- [x] `packages/backend/src/photos/thumbnail.service.ts` — ThumbnailService with generate(photoId) and cleanup(photoId, storageKey) methods
- [x] `packages/backend/src/photos/photo-thumbnail.worker.ts` — BullMQ worker for photo-thumbnail queue (extends WorkerHost)
- [x] `packages/backend/src/photos/photos.module.ts` — Add ThumbnailService and PhotoThumbnailWorker to providers
- [x] `packages/backend/src/photos/photos.controller.ts` — Add POST `/photos/:id/retry` endpoint
- [x] `packages/backend/src/photos/photos.service.ts` — Add `retry(photoId)` method that resets status and re-enqueues
- [x] `packages/backend/src/photos/thumbnail.service.spec.ts` — Unit tests for ThumbnailService edge cases
- [x] `packages/backend/src/photos/photos.service.spec.ts` — Add test for retry() method

**Acceptance Criteria:**
- Given a photo with status PROCESSING, when the thumbnail worker runs, then 320px WebP and 1200px JPEG are created at `/.thumbnails/...` and Photo status becomes READY
- Given a valid photo, when thumbnails succeed, then an ai-tagging job is enqueued with the same photoId
- Given a corrupt photo file, when the worker fails 3 times, then Photo status becomes FAILED and partial files are cleaned up
- Given a FAILED photo, when user POSTs `/api/photos/:id/retry`, then status resets to PROCESSING and a new thumbnail job is enqueued
- Given a non-FAILED photo, when user POSTs `/api/photos/:id/retry`, then a 409 Conflict is returned
- Given TypeScript compilation, when running `tsc --noEmit` from packages/backend/, then zero errors

## Suggested Review Order

**Thumbnail generation core**

- Entry point — thumbnail pipeline: generate, cleanup, path conventions
  [`thumbnail.service.ts:35`](../../packages/backend/src/photos/thumbnail.service.ts#L35)

- Worker wiring — BullMQ processor + failure handling
  [`photo-thumbnail.worker.ts:19`](../../packages/backend/src/photos/photo-thumbnail.worker.ts#L19)

**Retry endpoint**

- API surface — POST endpoint with user isolation
  [`photos.controller.ts:46`](../../packages/backend/src/photos/photos.controller.ts#L46)

- Business logic — status validation + re-enqueue
  [`photos.service.ts:119`](../../packages/backend/src/photos/photos.service.ts#L119)

- Module registration — providers and queue wiring
  [`photos.module.ts:5`](../../packages/backend/src/photos/photos.module.ts#L5)

**Tests**

- Thumbnail service — not-found, failure-cleanup, no-throw cleanup
  [`thumbnail.service.spec.ts:43`](../../packages/backend/src/photos/thumbnail.service.spec.ts#L43)

- Photos service — retry not-found, conflict, userId isolation, success
  [`photos.service.spec.ts:132`](../../packages/backend/src/photos/photos.service.spec.ts#L132)

<!-- Populated by step-04 during review loops -->

## Design Notes

**ThumbnailService.generate(photoId) flow:**
1. `prisma.photo.findUnique({ where: { id: photoId } })`
2. Read source file from `{PHOTO_ROOT}/{storageKey}`
3. `sharp(srcPath).metadata()` → get width/height
4. `sharp(srcPath).resize(320, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(gridPath)`
5. `sharp(srcPath).resize(1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toFile(previewPath)`
6. Update Photo: `{ thumbnailPath, previewPath, width, height, status: 'READY' }`
7. Enqueue `ai-tagging` job

**Worker uses `Worker` from BullMQ with `{ concurrency: 2, maxStalledCount: 0 }`.**
- On processor error: throw → BullMQ auto-retries (default 3 attempts)
- Uses `@nestjs/bullmq` `@Processor('photo-thumbnail')` decorator

## Verification

**Commands:**
- `cd /home/chrisnie/Code/smart-files/packages/backend && npx tsc --noEmit` — expected: zero errors
- `cd /home/chrisnie/Code/smart-files/packages/backend && npm run test` — expected: all tests pass (including new thumbnail service spec)
