---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - party-mode-discussion (2026-06-19)
---

# smart-files - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for smart-files, decomposing the architectural issues identified in party mode discussion into implementable epics and stories.

## Requirements Inventory

### Functional Requirements

FR1: Photo processing pipeline must implement saga/compensation pattern — every step must have a compensating action to revert partial state on failure.
FR2: System must automatically detect permanently stuck PROCESSING photos and trigger compensation.
FR3: File writes to mergerfs storage pool must be atomic with respect to PostgreSQL metadata commits.
FR4: Photo dedup via hash must prevent race conditions between concurrent uploads of identical files.
FR5: Orphaned files on mergerfs (written but metadata commit failed) must be discoverable and cleanable.
FR6: Orphaned database metadata (committed but file write failed) must be discoverable and cleanable.

### NonFunctional Requirements

NFR1: Zero photo loss — the system must not permanently lose a successfully uploaded photo under any single-point failure scenario.
NFR2: Self-healing — the system should eventually reach a consistent state without manual intervention.
NFR3: The compensation mechanism must not add latency to the common (happy) path.
NFR4: Backward compatible — existing photos already in PROCESSING/READY/FAILED state must be handled by the new mechanism.

### Additional Requirements

- Existing BullMQ queues (photo-thumbnail, ai-tagging) should be retained but wrapped with saga coordination.
- mergerfs pool topology awareness may be necessary for reliable file operations.
- An outbox or write-ahead log pattern may be needed for dual-write atomicity.

### UX Design Requirements

N/A — infrastructure/backend changes, no user-facing UI impact.

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR3 | Epic 1 | Atomic mergerfs + Postgres writes |
| FR4 | Epic 1 | Hash dedup race prevention |
| FR5 | Epic 1 | Orphaned file cleanup |
| FR6 | Epic 1 | Orphaned metadata cleanup |
| FR1 | Epic 2 | Saga/compensation for pipeline |
| FR2 | Epic 2 | Auto-detect stuck PROCESSING |

## Epic List

### Epic 1: Storage-DB Consistency
Photo files and their metadata always agree — no orphans, no duplicates.
**FRs covered:** FR3, FR4, FR5, FR6

### Epic 2: Reliable Photo Processing Pipeline
Photos never get lost or stuck mid-processing — system self-heals from failures.
**FRs covered:** FR1, FR2

## Epic 1: Storage-DB Consistency

Photo files and their metadata always agree — no orphans, no duplicates.

### Story 1.1: Atomic Upload with Dedup-First Flow

As a **user**,
I want uploading a photo to safely handle duplicates and storage failures,
So that I never get duplicate files or broken metadata.

**Acceptance Criteria:**

**Given** a photo upload is being processed
**When** the file hash is computed from temp data before any final write
**Then** the DB is checked first via `@unique([userId, hash])` constraint

**Given** a photo with hash H exists for user A
**When** user A uploads a photo with the same hash H
**Then** the DB unique constraint raises P2002 on insert
**And** the handler returns the existing photo record without writing any file to mergerfs

**Given** the hash is unique
**When** the DB insert succeeds
**Then** the file is written to mergerfs afterward (not before)

**Given** the file write is about to start
**When** the DB insert has committed
**Then** a `.processing` sidecar marker file is created alongside the target file

**Given** the file write completes
**When** the `.processing` marker exists
**Then** the marker is deleted to signal a clean write

**Given** a crash occurs between DB insert and file write completion
**When** the `.processing` marker is found on startup or by the reconciler
**Then** the associated DB record is marked as `ORPHANED` immediately — no need to wait for the 60-min cycle

**Given** the file write to mergerfs fails
**When** the error is caught
**Then** the DB record is removed and the `.processing` marker is cleaned up

### Story 1.2: Periodic Orphan Reconciliation

As a **system administrator**,
I want orphaned files and orphaned metadata to be automatically detected and cleaned up,
So that storage and database stay consistent over time.

**Acceptance Criteria:**

**Given** a BullMQ repeatable job is registered
**When** the backend starts
**Then** the orphan reconciliation job is registered with 60-minute interval and concurrency set to 1

**Given** the reconciliation job runs
**When** it finds DB records with no corresponding file on disk
**Then** those records are marked as `ORPHANED` state with a timestamp and reason logged

**Given** the reconciliation job runs
**When** it scans DB records
**Then** it skips any record with `updatedAt` within the last 5 minutes to avoid racing with live uploads

**Given** the reconciliation job runs
**When** it finds `.processing` marker files older than 1 hour
**Then** those are treated as crash orphans and their DB records are marked `ORPHANED`

**Given** the reconciliation job runs
**When** it finds files on mergerfs with no corresponding DB record (older than 1 hour)
**Then** those files are moved to a `.orphans/` quarantine directory
**And** files larger than 1GB are logged with a warning instead of being moved (disk-space safe)
**And** each skipped >1GB orphan increments a `storage.orphans.skipped_large` counter metric for alerting

**Given** the reconciliation job runs
**When** it finds `PhotoTag` rows referencing photos that are in `ORPHANED` state or no longer exist
**Then** those orphaned tag rows are deleted in a single transaction per batch

**Given** the reconciliation job runs
**When** it finds `PhotoTag` rows referencing a photo in `COMPLETED` state where no other tags exist
**Then** those rows are removed and a sweep log is emitted

**Given** the dataset contains 100K+ photos
**When** the reconciler scans
**Then** it uses cursor-based pagination (500 per batch) to avoid memory exhaustion
**And** if one cycle takes > 60 min, the next cycle is skipped to prevent overlap

### Story 1.3: Observability for Storage Health

As a **system administrator**,
I want visibility into storage consistency metrics,
So that I can detect and act on orphan accumulation before it becomes a problem.

**Acceptance Criteria:**

**Given** the observability layer is implemented
**When** the reconciler finds an orphan
**Then** a counter metric `storage.orphans.total` is incremented

**Given** a photo enters `ORPHANED` state
**When** the state changes
**Then** a log entry is emitted with photo ID, file path, and reason

**Given** the reconciler runs
**When** it completes a cycle
**Then** it logs: total records scanned, orphans found, files quarantined, duration

## Epic 2: Reliable Photo Processing Pipeline

Photos never get lost or stuck mid-processing — system self-heals from failures.

### Story 2.1: Saga State Machine & Crash Recovery

As a **system architect**,
I want a formal saga state machine with explicit transitions and crash recovery,
So that every photo processing step is idempotent and survives process restarts.

**Acceptance Criteria:**

**Given** the state machine is defined
**When** a photo enters the pipeline
**Then** the valid state transitions are:
- `UPLOADED → THUMBNAILING`
- `THUMBNAILING → TAGGING` (on success)
- `THUMBNAILING → THUMBNAIL_FAILED` (after all retries exhausted)
- `TAGGING → COMPLETED` (on success, or on failure with partial tags cleaned)
- `COMPLETED` is terminal

**Given** the saga state is persisted
**When** any state transition occurs
**Then** the update is written to the `Photo.status` field as a single atomic DB operation

**Given** the saga orchestrator crashes mid-processing
**When** the backend restarts
**Then** on startup, all photos in non-terminal states (`THUMBNAILING`, `TAGGING`) are reset to `UPLOADED` and re-queued for thumbnailing

**Given** two saga instances attempt to process the same photo ID
**When** the second instance starts
**Then** a distributed lock (Redis key `photo:lock:{photoId}` with 5-minute TTL) prevents concurrent processing
**And** the second instance aborts immediately without side effects

**Given** a thumbnail gen or tagging job runs longer than 5 minutes
**When** the Redis lock expires
**Then** the lock is refreshed with an extended TTL by the worker mid-processing, preventing false unlocking

**Given** BullMQ stalled-job handling
**When** a worker processes a photo
**Then** the job is designed to be idempotent — processing the same photo twice produces the same result

**Given** legacy photos in `PROCESSING` state
**When** the saga is deployed
**Then** a migration resets all `PROCESSING` photos to `UPLOADED` and re-queues them for thumbnailing

### Story 2.2: Compensating Actions for Each Step

As a **system engineer**,
I want each processing step to have a working compensation implementation,
So that partial failures are handled without data loss.

**Acceptance Criteria:**

**Given** a photo is in `UPLOADED` state
**When** thumbnailing is queued but the worker crashes before writing
**Then** the saga marks it as `THUMBNAIL_FAILED` and the original file remains intact on disk

**Given** a photo in `THUMBNAILING`
**When** thumbnails are written but AI tagging fails
**Then** a single transaction deletes all partial `PhotoTag` records for that photo
**And** the state becomes `COMPLETED` with thumbnails preserved and tags empty

**Given** a BullMQ job fails for a step
**When** all retries are exhausted
**Then** the orchestrator receives the final failure event and invokes the step's compensation

**Given** the DB delete for partial tags crashes mid-iteration
**When** a secondary cleanup sweep runs (part of next reconciler cycle)
**Then** it detects and removes any `PhotoTag` rows referencing photos in `COMPLETED` state with no tags

### Story 2.3: Periodic Thumbnail Retry Cron

As a **user**,
I want failed thumbnails to be retried automatically,
So that photos eventually appear in my grid without manual intervention.

**Acceptance Criteria:**

**Given** a BullMQ repeatable job is registered
**When** the backend starts
**Then** the thumbnail retry job is registered with a 60-minute interval

**Given** the retry job runs
**When** it queries photos in `THUMBNAIL_FAILED`
**Then** it processes at most 500 photos per tick to avoid queue flooding

**Given** a photo is in `THUMBNAIL_FAILED`
**When** the retry job picks it up
**Then** the photo is re-queued for thumbnailing with a new job ID

**Given** a photo has been retried 24 times (24 hours)
**When** the retry job runs again
**Then** the photo transitions to `THUMBNAIL_PERMANENTLY_FAILED` and is not retried again
**And** an alert-worthy log entry is emitted for manual inspection

**Given** a photo in `THUMBNAIL_FAILED`
**When** thumbnailing finally succeeds (at any attempt ≤ 24)
**Then** the state transitions to `TAGGING`, retry counter resets

**Given** 10,000 photos are in `THUMBNAIL_FAILED` simultaneously (e.g., after a disk reconnection)
**When** the retry job runs
**Then** it processes 500 per cycle in FIFO order by failure timestamp
**And** does not exceed the configured batch limit

**Given** the retry job runs
**When** a photo is already being thumbnailed by another worker
**Then** the per-photo lock (from Story 2.1) prevents duplicate processing
