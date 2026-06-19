---
baseline_commit: NO_VCS
---

# Story 1.2: Periodic Orphan Reconciliation

**Epic:** 1 — Storage-DB Consistency
**Status:** ready-for-dev

## Acceptance Criteria

1. BullMQ repeatable job registered on backend start, 60-min interval, concurrency=1
2. Skip records with `updatedAt` within last 5 minutes (warm-period guard against live uploads)
3. DB records without corresponding file on disk → mark `ORPHANED` state + timestamp + reason log
4. `.processing` marker files older than 1 hour → treat as crash orphans, mark DB record `ORPHANED`
5. Files on mergerfs with no DB record (older than 1 hour) → move to `.orphans/` quarantine
6. Files > 1GB logged with warning + `storage.orphans.skipped_large` counter instead of moved
7. Orphaned `PhotoTag` rows referencing photos in `ORPHANED` or non-existent states → delete in single transaction per batch
8. `PhotoTag` rows referencing photos in `COMPLETED` with no other tags → remove and log
9. Cursor-based pagination (500/batch) to avoid memory exhaustion
10. If one cycle takes > 60 min, skip next cycle to prevent overlap

## Tasks/Subtasks

- [x] **1.2.1** Create `OrphanReconcilerService` with BullMQ repeatable job registration
- [x] **1.2.2** Implement warm-period guard (skip `updatedAt` < 5 min)
- [x] **1.2.3** Implement DB record → file check (mark ORPHANED)
- [x] **1.2.4** Implement `.processing` marker detection for crash orphans
- [x] **1.2.5** Implement file → DB check with quarantine + 1GB skip + metric
- [x] **1.2.6** Implement orphaned PhotoTag sweep
- [x] **1.2.7** Add cursor-based pagination + cycle overlap prevention
- [x] **1.2.8** Write unit tests for all paths (19 tests, all passing)

## File List

- `packages/shared/prisma/schema.prisma` — added `ORPHANED` enum value, `orphanedAt`, `orphanReason`, `@@index([status, updatedAt])`
- `packages/backend/src/photos/orphan-reconciler.service.ts` — NEW: core reconciler service
- `packages/backend/src/photos/orphan-reconciler.service.spec.ts` — NEW: 19 tests
- `packages/backend/src/photos/photos.module.ts` — registered queue + provider

## Status

review
