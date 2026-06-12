# Blind Hunter Review — Story 2.1: Photo Thumbnail Pipeline

Review the following diff as a cynical, adversarial reviewer. You have NO spec, NO project context — only the diff below. Your job is to find bugs, security issues, missing error handling, and anything that looks wrong purely from the code changes.

Use the `bmad-review-adversarial-general` skill approach: find at least 10 issues. Be skeptical.

## Diff — Modified Files

### packages/backend/src/photos/photos.controller.ts
- Added `Param` import
- Added `@Post(':id/retry')` endpoint calling `photosService.retry(id)`
- `@CurrentUser()` decorator present but `user` is unused in the retry method

### packages/backend/src/photos/photos.module.ts
- Added `ThumbnailService` and `PhotoThumbnailWorker` to providers array

### packages/backend/src/photos/photos.service.ts
- Added `NotFoundException`, `ConflictException` imports
- Added `retry(photoId)` method:
  - `findUnique` → throw NotFoundException if missing
  - Status check → throw ConflictException if not FAILED
  - Update status to PROCESSING
  - Re-enqueue thumbnail job

### packages/backend/src/photos/photos.service.spec.ts
- Added `findUnique` and `update` mocks to prisma mock
- Added `retry` describe block with 3 test cases

## New Files

### packages/backend/src/photos/thumbnail.service.ts
- Sharp thumbnail generation service
- `generate(photoId)`: finds photo, creates thumbnails at `/.thumbnails/{user}/{YYYY}/{MM}/{id}_grid.webp` and `{id}_preview.jpg`, updates Photo record, enqueues ai-tagging
- `cleanup(photoId, storageKey)`: removes partial files on failure
- Uses `require('sharp')` with eslint disable comment

### packages/backend/src/photos/photo-thumbnail.worker.ts
- `@Processor('photo-thumbnail', { concurrency: 2 })` extends WorkerHost
- `process(job)`: calls thumbnailService.generate(photoId)
- `@OnWorkerEvent('failed')`: cleans up and sets status to FAILED

### packages/backend/src/photos/thumbnail.service.spec.ts
- Tests: photo not found, generate calls cleanup on failure, cleanup doesn't throw

## Verification
- `npx tsc --noEmit` — zero errors
- `npm run test` — 19/19 passed

Report your findings as a markdown list with at least 10 issues.