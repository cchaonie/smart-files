---
baseline_commit: 0c0cce7f1948f239bc96909ef3dce5c49e2c0fd5
---

# Story 1.4: Photo Upload API with BullMQ Integration

**Epic:** 1 - Family Photo Upload

## User Story

As a **backend developer**,
I want **a new NestJS `PhotoModule` with a photo upload endpoint that saves files to `/mnt/pool/{user}/{date}` and enqueues thumbnail + AI tagging jobs via BullMQ**,
So that **mobile clients can securely upload photos, and async processing kicks off automatically**.

## Acceptance Criteria

| Given | When | Then |
|-------|------|------|
| PHOTO_ROOT is set to `/mnt/pool` | I start the backend | PhotoModule initializes without errors |
| A user uploads a photo via POST `/api/photos/upload` | The request completes | File is saved to `/mnt/pool/{user}/{YYYY}/{MM}/` |
| Upload succeeds | A new Photo record is created | Photo has status `PROCESSING` |
| Upload completes | BullMQ jobs are enqueued | `photo-thumbnail` and `ai-tagging` jobs exist in the queue |
| A second upload of the same file (hash match) | Upload completes | FR-6 dedup logic: no duplicate file saved, existing Photo returned |
| Network failure during upload | Connection drops | Existing chunked upload retry logic resumes on retry |
| Existing file manager | I list files via GET `/api/files` | Unaffected — all existing file operations continue to work |

## Tasks / Subtasks

- [x] Create PhotoModule with controller and service
  - [x] Create photos module, controller, service files
  - [x] Register PhotoModule in AppModule
  - [x] Wire BullMQ queue definitions for `photo-thumbnail` and `ai-tagging`
- [x] Implement photo upload endpoint
  - [x] POST `/api/photos/upload` — accepts multipart file
  - [x] Compute SHA-256 hash of file content
  - [x] Check hash dedup — if exists, return existing Photo
  - [x] Determine storage path: `{PHOTO_ROOT}/{user}/{YYYY}/{MM}/{uuid}.{ext}`
  - [x] Write file to storage path
  - [x] Create Photo record in DB with status PROCESSING
  - [x] Return `{ id, status: "processing" }`
- [x] Enqueue BullMQ jobs on upload
  - [x] Define `photo-thumbnail` queue
  - [x] Define `ai-tagging` queue
  - [x] Enqueue both jobs after Photo record creation
- [x] Add JwtAuthGuard to PhotoController (all endpoints require auth)
- [x] Test the upload endpoint
  - [x] Unit test: hash computation (3 tests: correct hash, consistency, different content)
  - [x] Unit test: dedup logic (returns existing photo without creating or enqueuing)
  - [x] Unit test: file path generation (username, date, extension, month padding)
  - [x] Integration test: upload creates photo + enqueues 2 jobs

## Dev Notes

- Use multer for multipart file handling (already available in NestJS via `FileInterceptor`)
- Hash file with crypto.createHash('sha256') in chunks to handle large files
- Use `uuid` for file names (maintain original extension)
- Date format: `{YYYY}/{MM}` two-digit month, no leading slash for single-digit months
- Storage path components: `PHOTO_ROOT` env var → `/mnt/pool`
- BullMQ queues should be registered using `@nestjs/bullmq` `RegisterQueue` decorator or `BullModule.registerQueue`
- Import PrismaModule to access PrismaService in PhotoService
- PhotoService should use ConfigService for PHOTO_ROOT (already set up via RedisService pattern)
- Import path: `import { createHash } from 'node:crypto'`
- Existing upload system (`UploadModule`) is for chunked file uploads — Photo upload is a simple multipart POST (single file)
- Response format: `{ id: string, status: "PROCESSING" }`

## Dev Agent Record

### Implementation Plan

1. Create PhotoModule, PhotoController, PhotoService via NestJS CLI
2. Register queues in PhotoModule
3. Implement upload endpoint with multer
4. Implement file hashing, dedup, storage
5. Implement BullMQ job enqueuing
6. Add auth guard
7. Write tests
8. Run full test suite

### Completion Notes

Story 1.4 completed on 2026-06-12.

Created PhotoModule with:
- `POST /api/photos/upload` authenticated endpoint (multipart file upload)
- SHA-256 hash-based dedup — same hash returns existing Photo without duplicate
- File stored at `/mnt/pool/{username}/{YYYY}/{MM}/{uuid}.{ext}`
- PHOTO_ROOT read from ConfigService (defaults to `/mnt/pool`)
- BullMQ queues: `photo-thumbnail` and `ai-tagging` — both enqueued on upload
- JwtAuthGuard protects all photo endpoints
- 7 unit tests: hash, path generation, dedup, create+enqueue
- Full suite: 12/12 pass, zero regressions

## File List

- `packages/backend/src/photos/photos.module.ts` — new
- `packages/backend/src/photos/photos.controller.ts` — new
- `packages/backend/src/photos/photos.service.ts` — new
- `packages/backend/src/photos/photos.service.spec.ts` — new
- `packages/backend/src/app.module.ts` — modified (register PhotoModule)
- `package.json` — modified (added @types/multer devDep)
- `_bmad-output/implementation-artifacts/1-4-photo-upload-api.md` — this file

## Change Log

| Date | Change |
|------|--------|
| 2026-06-12 | Initial story created |

## Status

review
