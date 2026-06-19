---
baseline_commit: NO_VCS
---

# Story 2.1: Saga State Machine & Crash Recovery

**Epic:** 2 — Reliable Photo Processing Pipeline
**Status:** ready-for-dev

## Acceptance Criteria

1. State machine with valid transitions: `UPLOADED → THUMBNAILING → TAGGING → COMPLETED`, branch `THUMBNAILING → THUMBNAIL_FAILED` (after retries exhausted)
2. Saga state persisted in `Photo.status` as single atomic DB operation per transition
3. On backend restart: all photos in non-terminal states (`THUMBNAILING`, `TAGGING`) reset to `UPLOADED` and re-queued for thumbnailing
4. Per-photo distributed lock (Redis `photo:lock:{photoId}`, 5-min TTL, worker refreshes mid-processing)
5. BullMQ jobs designed idempotently — same photo processed twice produces same result
6. Legacy `PROCESSING` photos migrated: reset to `UPLOADED` and re-queued

## Tasks/Subtasks

- [ ] **2.1.1** Update `PhotoThumbnailWorker` to use new state machine transitions (UPLOADED → THUMBNAILING → TAGGING/COMPLETED)
- [ ] **2.1.2** Add per-photo Redis lock with TTL refresh
- [ ] **2.1.3** Implement startup crash recovery (reset non-terminal states)
- [ ] **2.1.4** Add migration for legacy `PROCESSING` photos
- [ ] **2.1.5** Ensure BullMQ job idempotency
- [ ] **2.1.6** Write tests

## Dev Notes

- `packages/backend/src/photos/photo-thumbnail.worker.ts` — main file to modify
- `packages/backend/src/photos/thumbnail.service.ts` — update status transitions
- Redis lock: use `ioredis` directly or `@nestjs/bullmq`'s built-in lock features
- Startup recovery: use `@nestjs/bullmq` `QueueEvents` or `OnApplicationBootstrap`
- The per-photo lock prevents concurrent saga instances from processing the same photo (e.g., retry cron + upload both trying to thumbnail)

## Status

ready-for-dev
