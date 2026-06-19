---
baseline_commit: NO_VCS
---

# Story 1.3: Observability for Storage Health

**Epic:** 1 — Storage-DB Consistency
**Status:** ready-for-dev

## Acceptance Criteria

1. Counter metric `storage.orphans.total` incremented when reconciler finds an orphan
2. Log entry emitted for each orphan detection with photo ID, file path, and reason
3. Reconciler cycle summary logged: total records scanned, orphans found, files quarantined, duration
4. `storage.orphans.skipped_large` counter for >1GB skip events
5. Metrics exposed via a `GET /api/health/storage` endpoint (or appended to existing health check)

## Tasks/Subtasks

- [ ] **1.3.1** Add metric counters to `OrphanReconcilerService`
- [ ] **1.3.2** Add structured logging for orphan events
- [ ] **1.3.3** Add reconciler cycle summary logging
- [ ] **1.3.4** Expose storage health metrics via endpoint
- [ ] **1.3.5** Write tests

## Dev Notes

- Builds on Story 1.2's `OrphanReconcilerService`
- Metrics can use NestJS built-in logger or a simple in-memory counter
- Health endpoint can be part of an existing health check controller or new

## Status

ready-for-dev
