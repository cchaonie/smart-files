---
baseline_commit: NO_VCS
---

# Story 1.1: Atomic Upload with Dedup-First Flow

**Epic:** 1 — Storage-DB Consistency
**Status:** ready-for-dev

## Acceptance Criteria

1. Hash is computed from temp upload data before any final file write
2. DB insert uses `@unique([userId, hash])` constraint for dedup
3. On P2002 (duplicate), existing photo record is returned and no file is written
4. On unique hash, DB insert succeeds first, then file is written to mergerfs
5. A `.processing` sidecar marker file is created alongside the target file during write
6. On write completion, the `.processing` marker is deleted
7. If file write fails, the DB record is removed and `.processing` marker is cleaned up
8. If a crash occurs between DB insert and file write, the `.processing` marker allows the reconciler to detect it

## Tasks/Subtasks

- [x] **1.1.1** Add `UPLOADED`, `THUMBNAIL_FAILED`, `THUMBNAIL_PERMANENTLY_FAILED`, `TAGGING`, `COMPLETED` to `PhotoStatus` enum; change `hash @unique` to `@@unique([userId, hash])`
- [x] **1.1.2** Refactor upload flow: compute hash from buffer before DB insert (no race-prone findFirst)
- [x] **1.1.3** Implement dedup-first logic: try DB insert with `@@unique(userId, hash)`, catch P2002 → return existing (no file write)
- [x] **1.1.4** After DB insert succeeds, write `.processing` marker, then file to mergerfs, then delete marker
- [x] **1.1.5** On write failure, rollback DB record + cleanup marker/file; crash leaves marker for reconciler
- [x] **1.1.6** Write unit tests for all paths (happy, P2002 dupe, write failure rollback, no file write on dedup)

## Dev Notes

- Upload flow in `packages/backend/src/photos/photos.service.ts`
- Prisma schema at `packages/shared/prisma/schema.prisma`
- New states in `PhotoStatus` enum: `UPLOADED`, `THUMBNAIL_FAILED`, `THUMBNAIL_PERMANENTLY_FAILED`, `TAGGING`, `COMPLETED`
- Changed `hash @unique` (global) → `@@unique([userId, hash])` (per-user) — also fixes a pre-existing bug where two different users uploading the same photo would crash on the global unique constraint
- The `.processing` marker is a zero-byte file at `{absolutePath}.processing`
- Removed direct `ai-tagging` queue enqueue from upload — thumbnail service now chains to ai-tagging after thumbnails complete
- Fixed Jest `transformIgnorePatterns` for `uuid` ESM module
- Added `PrismaClientKnownRequestError` (P2002) handling for atomic dedup

## File List

- `packages/shared/prisma/schema.prisma` — PhotoStatus enum extended, `@@unique([userId, hash])` added
- `packages/backend/src/photos/photos.service.ts` — upload() rewritten with dedup-first atomic flow
- `packages/backend/src/photos/photos.controller.ts` — removed unused `ConflictException` import
- `packages/backend/src/photos/photos.service.spec.ts` — tests updated for new flow
- `packages/backend/package.json` — added `transformIgnorePatterns` for uuid ESM

## Status

review
