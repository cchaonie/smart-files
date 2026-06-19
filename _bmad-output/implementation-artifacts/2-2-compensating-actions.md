---
baseline_commit: NO_VCS
---

# Story 2.2: Compensating Actions for Each Step

**Epic:** 2 — Reliable Photo Processing Pipeline
**Status:** ready-for-dev

## Acceptance Criteria

1. `THUMBNAILING` failure compensation: keep original file, mark `THUMBNAIL_FAILED`, do NOT delete anything
2. `TAGGING` failure compensation: single-transaction delete partial `PhotoTag` records, keep thumbnails, mark `COMPLETED`
3. BullMQ job failure after all retries: orchestrator receives final failure event, invokes step's compensation

## Tasks/Subtasks

- [ ] **2.2.1** Implement THUMBNAILING failure compensation in worker `onFailed` handler
- [ ] **2.2.2** Implement TAGGING failure compensation with transaction-scoped tag cleanup
- [ ] **2.2.3** Wire orchestrator to invoke correct compensation based on current state
- [ ] **2.2.4** Write tests

## Dev Notes

- `packages/backend/src/photos/photo-thumbnail.worker.ts` — update `onFailed`
- `packages/backend/src/ai-tagging/ai-tagging.worker.ts` — update `onFailed`
- Key principle: never delete original photo files. Keep what's useful.
- Tag cleanup: use `prisma.$transaction` for atomicity

## Status

ready-for-dev
