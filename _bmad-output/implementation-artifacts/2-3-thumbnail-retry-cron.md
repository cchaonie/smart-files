---
baseline_commit: NO_VCS
---

# Story 2.3: Periodic Thumbnail Retry Cron

**Epic:** 2 — Reliable Photo Processing Pipeline
**Status:** ready-for-dev

## Acceptance Criteria

1. BullMQ repeatable job registered on backend start, 60-min interval
2. Queries photos in `THUMBNAIL_FAILED`, processes max 500 per tick (FIFO by failure timestamp)
3. Each photo re-queued for thumbnailing with new job ID
4. After 24 retries → `THUMBNAIL_PERMANENTLY_FAILED` + alert log entry
5. Success at any attempt → transitions to `TAGGING`, resets retry counter
6. Per-photo lock (from Story 2.1) prevents duplicate processing with concurrent thumbnail jobs

## Tasks/Subtasks

- [ ] **2.3.1** Create thumbnail retry service with BullMQ repeatable job
- [ ] **2.3.2** Implement retry logic: query, batch limit, FIFO order, per-photo lock
- [ ] **2.3.3** Implement 24-retry ceiling → `THUMBNAIL_PERMANENTLY_FAILED`
- [ ] **2.3.4** Wire retry counter tracking (new field on Photo model or Redis)
- [ ] **2.3.5** Write tests

## Dev Notes

- Retry counter: simplest is a `retryCount` field on the `Photo` model
- Prisma schema: add `retryCount Int @default(0)` to Photo
- Register the repeatable job in the photos module
- Use existing `photo-thumbnail` queue (same queue, different job name or same)
- Per-photo Redis lock ensures the retry cron doesn't fight with a concurrent upload of the same photo

## Status

ready-for-dev
