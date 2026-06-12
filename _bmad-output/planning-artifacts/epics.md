---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - prd-smart-files-2026-06-11/prd.md
  - architecture.md
---

# smart-files - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for smart-files, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

- **FR-1**: New Photo Detection — Scan for untracked photos on launch + periodic background check
- **FR-2**: Upload Prompt — Show non-intrusive prompt with Upload/Later options
- **FR-3**: Background Upload — Upload continues after confirmation, survives app backgrounding
- **FR-4**: Upload Progress & Completion — Visible progress, completion notification with cleanup option
- **FR-5**: Local Cleanup — Delete confirmed originals from device
- **FR-6**: Upload Resilience — Retry with exponential backoff, hash-based dedup
- **FR-7**: Auto-Tagging — Server runs image classification with defined 10-tag taxonomy
- **FR-8**: Tag Search — Search photos by tag with auto-suggest
- **FR-9**: Tag Filtering — Tag browser/filter UI with counts
- **FR-10**: Timeline View — Photos by date (newest first), grouped by day/month
- **FR-11**: Responsive Thumbnail Grid — Fast loading, smooth scroll, lazy thumbnails
- **FR-12**: Quick Scroll — Date picker to jump to specific month/year
- **FR-13**: User Accounts — Admin invites family via shareable link
- **FR-14**: Personal Library — Private per-user photo space, invisible by default
- **FR-15**: Album Sharing — Invite users as viewer or contributor
- **FR-16**: Family Timeline — Aggregated shared content in unified timeline
- **FR-17**: Configurable Server URL — Cloudflare Tunnel domain configuration

### NonFunctional Requirements

- **NFR-1**: HTTPS only (Cloudflare Tunnel — already set up)
- **NFR-2**: Password strength (min 8 chars, no complexity rules)
- **NFR-3**: Photo privacy — personal library private by default
- **NFR-4**: Upload throughput should saturate home internet upload
- **NFR-5**: Thumbnail grid instant browsing with lazy-load
- **NFR-6**: Original photo files preserved as source of truth
- **NFR-7**: Pooled external USB storage via mergerfs
- **NFR-8**: Folder structure `{username}/{YYYY}/{MM}/`
- **NFR-9**: Storage visibility — users see remaining space
- **NFR-10**: Per-user quota support (architecturally, not enforced in v1)
- **NFR-11**: Upload resilience with exponential backoff
- **NFR-12**: Pool resilience — failed drive doesn't affect others

### Additional Requirements

- New Prisma models: Photo, Album, PhotoTag, SharedAlbum, PhotoAlbumMember
- BullMQ + Redis job queue setup for async processing
- ONNX Runtime Node.js + MobileNet-v3 for AI tagging
- Sharp thumbnail pipeline (320px WebP grid + 1200px JPEG preview)
- mergerfs pooled storage at `/mnt/pool`
- Redis installation via `apt install redis-server`
- Expo Android app extension for camera roll access + foreground upload
- New API modules: `/api/photos`, `/api/albums`, `/api/albums/:id/members`

### UX Design Requirements

N/A — No UX design document was created for this project.

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR-1 | Epic 1 | New photo detection on Android |
| FR-2 | Epic 1 | Upload prompt with Upload/Later |
| FR-3 | Epic 1 | Background upload |
| FR-4 | Epic 1 | Upload progress and completion |
| FR-5 | Epic 1 | Local cleanup of originals |
| FR-6 | Epic 1 | Upload resilience and dedup |
| FR-7 | Epic 2 | Auto-tagging via ONNX |
| FR-8 | Epic 2 | Tag search with auto-suggest |
| FR-9 | Epic 2 | Tag filter browser |
| FR-10 | Epic 2 | Timeline view by date |
| FR-11 | Epic 2 | Responsive thumbnail grid |
| FR-12 | Epic 2 | Quick scroll date picker |
| FR-13 | Epic 3 | Admin family account invitations |
| FR-14 | Epic 3 | Private personal library |
| FR-15 | Epic 3 | Album sharing with roles |
| FR-16 | Epic 3 | Aggregated family timeline |
| FR-17 | Epic 1 | Configurable server URL |

## Epic List

### Epic 1: Family Photo Upload
Users can upload photos from their Android phone to the NAS and free up phone storage.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-17

### Story 1.1: Redis & BullMQ Infrastructure Setup

As a **system administrator**,
I want **Redis installed, configured, and the BullMQ module wired into the NestJS backend**,
So that **async photo processing jobs have a reliable message queue**.

**Acceptance Criteria:**

**Given** the server runs Debian/Ubuntu
**When** I run `apt install redis-server`
**Then** Redis is active as a systemd service on port 6379
**And** the NestJS app starts with `@nestjs/bullmq` configured and connects to Redis without errors

**Given** the NestJS app is running
**When** I check the logs or a health endpoint
**Then** Redis connectivity is confirmed (PONG response)

**Given** Redis restarts
**When** the app reconnects
**Then** no crash loop occurs, reconnection succeeds gracefully

**Given** a CI environment
**When** the test suite runs
**Then** a Redis Testcontainers instance spins up and passes a connectivity test

### Story 1.2: Photo Domain Prisma Models & Production Migration

As a **backend developer**,
I want **the complete Prisma schema for Photo, PhotoTag, Album, PhotoAlbumMember, and SharedAlbum models, plus a production-safe `migrate deploy` workflow**,
So that **all downstream features have a stable data foundation, and production database updates are safe and predictable**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| Schema is updated with all 5 new models + PhotoStatus enum | I run `npx prisma validate` | Validation passes with no errors |
| Schema is valid | I run `npx prisma migrate dev --name add-photo-domain` | Migration SQL files are generated in `prisma/migrations/` |
| Migration files are reviewed | I inspect the generated SQL | All 5 tables (Photo, PhotoTag, Album, PhotoAlbumMember, SharedAlbum), PhotoStatus enum, FKs, and indexes are present |
| Dev migration applied | I run `prisma migrate status` | Database is up-to-date with no pending migrations |
| Code is deployed to production | I git pull the new schema + migration files | Production has the new migration ready to apply |
| Production deploy | I run `npx prisma migrate deploy` (NOT `migrate dev`) | Pending migration is applied to prod DB safely |
| After prod migration | I run `prisma generate` in backend | Prisma Client includes new Photo/Album types |
| Non-destructive | Existing File/Folder/Share tables are untouched | All existing data remains intact |
| CI pipeline | CI script runs `prisma migrate deploy` | Migration is automatically applied in deploy step |

**Production Migration Strategy:**

```bash
# 🔴 NEVER on production:
#   npx prisma migrate dev   — creates/edits migration files, not safe

# ✅ Production deploy:
cd packages/shared
npx prisma migrate deploy    # Apply pending migrations only
npx prisma generate          # Regenerate Prisma Client
```

**Workflow:** `schema change → prisma migrate dev (dev only) → git commit schema + migration files → git push → production: git pull → prisma migrate deploy`

### Epic 1 — Remaining Stories

---

### Story 1.3: mergerfs Storage Pool Setup

As a **system administrator**,
I want **mergerfs installed and configured to pool multiple external USB drives into a single mount point at `/mnt/pool`**,
So that **photo storage can transparently span multiple drives, and new drives can be added without data migration**.

**Design Note — Two-Phase Storage Strategy:**

| Phase | Photo storage | File storage | Description |
|-------|--------------|--------------|-------------|
| **Phase 1 (now)** | `/mnt/pool/{user}/{date}` | `./data/storage/` (unchanged) | Photo module writes to the pool; existing file manager untouched |
| **Phase 2 (future)** | `/mnt/pool/{user}/{date}` | `/mnt/pool/smart-files/` | After Story 1.8, all storage is unified under the pool |

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| Server runs Debian | I run `apt install mergerfs` | mergerfs binary is installed |
| Two+ USB drives are plugged in | I mount them and configure mergerfs to fuse them | `/mnt/pool` shows combined contents of all drives |
| A new USB drive is added | I update mergerfs config and remount | New drive's space is immediately available |
| A file is written to `/mnt/pool/chris/2026/06/` | System creates the file | It lands on a pooled drive with space balancing |
| A USB drive is removed | I unmount it | Remaining drives stay accessible; system continues |
| An app queries available space | It reads `/mnt/pool` disk stats | Total/used/free space across the pool is reported correctly |

---

### Story 1.4: Photo Upload API with BullMQ Integration

As a **backend developer**,
I want **a new NestJS `PhotoModule` with a photo upload endpoint that saves files to `/mnt/pool/{user}/{date}` and enqueues thumbnail + AI tagging jobs via BullMQ**,
So that **mobile clients can securely upload photos, and async processing kicks off automatically**.

**Design Decisions:**
- New `PHOTO_ROOT=/mnt/pool` env variable (independent from existing `UPLOAD_ROOT=./data/storage`)
- Upload writes to `{PHOTO_ROOT}/{username}/{YYYY}/{MM}/{uuid}.{ext}`
- Response returns `{ id, status: "processing" }` immediately — client does not wait for thumbnails/tags
- BullMQ job `photo-thumbnail` + `ai-tagging` are enqueued on upload completion

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| PHOTO_ROOT is set to `/mnt/pool` | I start the backend | PhotoModule initializes without errors |
| A user uploads a photo via POST `/api/photos/upload` | The request completes | File is saved to `/mnt/pool/{user}/{YYYY}/{MM}/` |
| Upload succeeds | A new Photo record is created | Photo has status `PROCESSING` |
| Upload completes | BullMQ jobs are enqueued | `photo-thumbnail` and `ai-tagging` jobs exist in the queue |
| A second upload of the same file (hash match) | Upload completes | FR-6 dedup logic: no duplicate file saved, existing Photo returned |
| Network failure during upload | Connection drops | Existing chunked upload retry logic resumes on retry |
| Existing file manager | I list files via GET `/api/files` | Unaffected — all existing file operations continue to work |

---

### Story 1.5: Android Photo Detection & Upload

As an **Android user**,
I want **the app to detect new photos in my camera roll and prompt me to upload them to the NAS**,
So that **I don't have to manually select and upload each photo**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User opens the app | App scans camera roll for untracked photos since last sync | New photos are detected and counted |
| 5 new photos found | User sees in-app prompt | "5 new photos found. Upload to NAS?" with Upload / Later |
| User taps Upload | Photos begin transferring | Upload runs in background via Android foreground service |
| 0 new photos | App launches | No prompt is shown |
| User taps Later | Prompt dismissed | Not re-prompted during this session |
| App is sent to background mid-upload | User switches apps | Upload continues (foreground service with persistent notification) |

---

### Story 1.6: Upload Progress & Local Cleanup

As an **Android user**,
I want **to see upload progress and, once complete, delete the local copies to free phone space**,
So that **I know my photos are safely stored and can confidently clear device storage**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| 5 photos are uploading | User views upload screen | Progress shows "3 of 5 uploaded" with per-photo status |
| All 5 photos uploaded | Upload completes | System notification: "5 photos uploaded safely" |
| Notification is tapped | User opens notification | Prompt: "Delete local copies to free space?" with Yes / No |
| User taps Yes | Local files are deleted | Phone storage is freed; photos remain on NAS |
| Deletion fails for 1 photo | Partial failure | User is informed which photo(s) could not be deleted |
| User selects No | Cleanup skipped | Photos remain on device — can be cleaned up later from settings |

---

### Story 1.7: Configurable Server URL

As an **Android user**,
I want **the app to connect to a custom server URL that I configure in settings**,
So that **I can access the NAS remotely via Cloudflare Tunnel from outside my home network**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User opens Settings | They see "Server URL" field | Default value shown is the current configured URL |
| User enters `https://photos.example.com` and saves | App reconnects | All API calls go to the new URL |
| User is on home Wi-Fi | App connects via local IP if configured | Auto-detection works; falls back to configured URL |
| User is on mobile data | App connects via Cloudflare Tunnel URL | Remote access works seamlessly |
| URL is invalid | App attempts to connect | Clear error message shown; option to edit URL |

---

### Story 1.8: Storage Unification Migration — Zero-Impact Migration to Pool

As a **system administrator**,
I want **all existing files from `./data/storage/` migrated to `/mnt/pool/smart-files/`, and `UPLOAD_ROOT` updated, without any user-visible impact**,
So that **all storage is unified under the pool and the migration is transparent to every user**.

**Why This Works Transparently:**

`File.storageKey` stores **relative paths** (e.g., `chris/uuid/photo.jpg`). Only the base path (`UPLOAD_ROOT`) changes. Since the relative structure is preserved during migration, every existing file reference continues to resolve correctly — no database changes needed.

**Migration Procedure (Online → Brief Downtime → Switch):**

```bash
# Step 1 — Online copy (app keeps running)
rsync -av --progress ./data/storage/ /mnt/pool/smart-files/

# Step 2 — Brief maintenance window (< 2 minutes)
pm2 stop smart-files-backend        # Stop app
rsync -av --delete ./data/storage/ /mnt/pool/smart-files/  # Final incremental sync

# Step 3 — Switch
# Edit .env: UPLOAD_ROOT=/mnt/pool/smart-files

# Step 4 — Verify
pm2 start smart-files-backend       # Restart
# Test: download a few existing files, verify they serve correctly

# Step 5 — Rollback plan (zero data loss)
# Revert UPLOAD_ROOT back to ./data/storage, pm2 restart
# All original files are untouched on the original path
```

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| mergerfs pool is active at `/mnt/pool` | I run `rsync` to copy `./data/storage/*` to `/mnt/pool/smart-files/` | All files transferred with exact relative structure preserved |
| Copy completes | I verify file counts and checksum a sample | Integrity confirmed — no data loss |
| App is stopped | I update `UPLOAD_ROOT` to `/mnt/pool/smart-files/` | Config is updated |
| App restarts | User requests a previously uploaded file via GET `/api/files/:id/download` | File serves correctly from new location |
| App restarts | User requests their file list via GET `/api/files` | All files appear exactly as before — no missing entries |
| App restarts | User uploads a new file | It is saved to `/mnt/pool/smart-files/{user}/{uuid}/` |
| **Rollback scenario** | Revert `UPLOAD_ROOT` and restart | System operates from original `./data/storage/` — zero data loss, original files untouched |
| Migration completed | User reports no issues | Zero user-visible change — all files, downloads, uploads, and thumbnails work identically |

**Final Directory Layout:**
```
/mnt/pool/
├── smart-files/             ← File model files (migrated from ./data/storage/)
│   └── {user}/{uuid}/
├── {username}/              ← Photo model files
│   └── {YYYY}/{MM}/
└── .thumbnails/             ← Generated thumbnail cache
```

---

### Epic 2: Photo Discovery & AI
Users can browse photos by date and instantly find what they need via AI-powered tags.
**FRs covered:** FR-7, FR-8, FR-9, FR-10, FR-11, FR-12

### Story 2.1: Photo Thumbnail Pipeline — Sharp + BullMQ

As a **backend developer**,
I want **a BullMQ worker that generates thumbnails using Sharp on every uploaded photo, saving 320px WebP grid thumbnails and 1200px JPEG previews**,
So that **the timeline grid loads quickly and photo browsing feels instant**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| A photo is uploaded with status `PROCESSING` | The `photo-thumbnail` BullMQ job fires | Thumbnail generation begins |
| Job completes | Both thumbnail sizes are created | 320px WebP saved to `/mnt/pool/.thumbnails/{user}/{YYYY}/{MM}/{id}_grid.webp`; 1200px JPEG saved to `{id}_preview.jpg` |
| Thumbnails exist | Backend updates Photo record | `thumbnailPath` and `previewPath` are set; status changes to `READY` (or `PROCESSING` for next job in chain) |
| Photo is a large RAW file (50MB+) | Sharp processes it | Memory usage stays reasonable; Sharp streams the image without loading the whole file into RAM |
| Photo is corrupt / job fails after 3 retries | BullMQ exhausts retries | Photo status set to `FAILED`; any partially written temp files in `.thumbnails/` are cleaned up |
| Photo status is `FAILED` | User views the photo in-app | A distinct error indicator is shown (e.g., red badge) with a "Retry" action |
| User taps Retry on a failed photo | API endpoint re-enqueues `photo-thumbnail` job | Thumbnails are regenerated from scratch |
| A thumbnail already exists | Same photo is re-processed (retry or re-upload) | Existing thumbnails are overwritten |

---

### Story 2.2: AI Auto-Tagging — ONNX Runtime + MobileNet

As a **backend developer**,
I want **a BullMQ worker that runs MobileNet-v3 via ONNX Runtime to classify every uploaded photo and persist tags to PhotoTag**,
So that **users can find photos by searching auto-generated tags without manual tagging**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| A photo's thumbnail job completes (`READY`) | The `ai-tagging` BullMQ job fires | ONNX classifies the photo against the defined tag taxonomy (baby, outdoor, food, group, document, sunset, pet, toy, etc.) |
| Classification completes | Tags are saved to `PhotoTag` | Tags are stored in **Chinese** (e.g., "宝宝", "户外", "美食") via a label mapping table (MobileNet EN → ZH) |
| Photo has no recognizable objects | ONNX returns low-confidence scores (< threshold) | No tags are saved; photo remains untagged (status unchanged) |
| ONNX model fails to load | Job fails after 3 retries | Photo status set to `FAILED`; partially written temp files cleaned up; user sees Retry action |
| User taps Retry | API re-enqueues `ai-tagging` job | Classification runs again from scratch |
| Same photo is re-processed | AI tagging runs on it again | No duplicate PhotoTag records (unique constraint on `[photoId, tag]`) |

---

### Story 2.3: Photo Timeline API + Web UI

As a **web user**,
I want **to browse my photos in a reverse-chronological timeline with thumbnails, date grouping, and a quick-scroll date picker**,
So that **I can quickly find and view photos from any time period**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User navigates to `/photos` | Page loads | Photos are displayed newest-first, grouped by day with month headers |
| User scrolls down | Next batch of photos loads | Lazy-loaded thumbnails appear; scroll remains smooth (60fps) |
| User clicks a date in the date picker | Timeline jumps to that month | Photos from the selected period are immediately shown |
| User has 10,000+ photos | Timeline page loads | Initial grid renders within 2 seconds; thumbnails lazy-load on scroll |
| User clicks a photo thumbnail | Photo viewer opens | Full-resolution preview image is shown (1200px JPEG) with photo metadata (date, file size, tags) |
| Photo has tags | User views photo detail | Tags are displayed under the photo |

---

### Story 2.4: Tag Search & Filter API + Web UI

As a **web user**,
I want **to search photos by typing tag names with auto-suggest, and filter the timeline by selecting tags from a tag browser**,
So that **I can find specific photos without scrolling through thousands**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User types "宝" in the search bar | Auto-suggest dropdown appears | Matching tags shown: "宝宝 (42)" |
| User selects "宝宝" from suggestions | Timeline filters | Only photos with "宝宝" tag are shown; filter count displayed |
| User opens tag filter panel | Tag browser is shown | All available tags listed as "标签名 (数量)", sorted by count descending |
| User taps a tag in the browser | Filter applies immediately | Timeline updates to show only matching photos |
| User wants to remove the filter | Clicks "Clear" or "X" | All photos are shown again; filter is removed |
| No results match the filter | Search returns zero results | "No photos match this filter" empty state shown with option to clear |

---

### Story 2.5: Mobile Photo Timeline — Expo Screens

As a **mobile user**,
I want **to browse my photos in a timeline view on my phone, with thumbnails and date grouping**,
So that **I can view my NAS photos on the go**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User opens Photo Timeline tab | Screen loads | Photos displayed in reverse-chronological order with thumbnails |
| User scrolls down | More photos load | Infinite scroll with lazy-loaded thumbnails |
| User taps a photo | Full-screen viewer opens | Preview image shown (1200px JPEG); metadata displayed |
| Photo has tags | User views photo detail | Tags shown below the photo |
| User has 5,000+ photos | Timeline loads | First batch renders within 3 seconds over mobile data (Cloudflare Tunnel) |

---

### Story 3.1: Album CRUD API

As a **user**,
I want **to create, list, update, and delete albums, where each album has a name, description, and optional cover photo, and belongs to my personal library**,
So that **I can organize my photos into meaningful collections**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User is logged in | They POST `/api/albums` with name + description | Album is created, owned by the user |
| User views albums page | They GET `/api/albums` | Only their own albums are returned (personal library, FR-14) |
| User edits an album | They PATCH `/api/albums/:id` with new name | Album name is updated |
| Album has no photos | User deletes it via DELETE `/api/albums/:id` | Album is removed |
| User tries to edit another user's album | They PATCH `/api/albums/:id` for an album they don't own | 403 Forbidden |
| New user registers | They GET `/api/albums` | Empty album list is returned |

---

### Epic 3 — Remaining Stories

### Story 3.2: Album Sharing API

As a **user**,
I want **to invite other family members to my albums as viewers (read-only) or contributors (can add their own photos), and revoke access when needed**,
So that **family members can collaborate on shared photo collections**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User owns Album A | They POST `/api/albums/A/share` with userId + role "VIEWER" | A SharedAlbum record is created linking user → album with VIEWER role |
| User owns Album A | They POST `/api/albums/A/share` with userId + role "CONTRIBUTOR" | A SharedAlbum record with CONTRIBUTOR role |
| Viewer opens Album A | They view the album | They can see all photos but cannot add/remove anything |
| Contributor opens Album A | They add a photo from their library to Album A | Photo is added; `PhotoAlbumMember` records `addedById` = contributor |
| Album owner revokes access | They DELETE `/api/albums/A/share/:userId` | The user's access is removed immediately |
| User A tries to share another user's album | They call the share endpoint on an album they don't own | 403 Forbidden |
| User B tries to add a photo to Album A as VIEWER | They call add-photo endpoint | 403 Forbidden |

---

### Story 3.3: Family Timeline API

As a **user**,
I want **a single unified timeline that shows photos from all albums shared with me, sorted by capture date regardless of uploader**,
So that **I don't have to switch between albums to see everyone's photos from the same event**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User has access to 3 shared albums (own + shared by others) | They GET `/api/family-timeline` | All photos from all accessible albums are returned, sorted by captureDate DESC |
| Same photo exists in two albums (same hash) | Timeline loads | Photo appears only once (dedup by hash, FR-16) |
| User has no shared albums | They GET `/api/family-timeline` | Empty results with "No shared moments yet" message |
| A new photo is added to a shared album | User refreshes timeline | New photo appears in the correct chronological position |

---

### Story 3.4: Web Album UI

As a **web user**,
I want **to manage my albums, share them with family members, and see a family timeline — all from the browser**,
So that **I can organize and share photos without needing the mobile app**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User navigates to `/albums` | Page loads | List of their albums shown, with "Create Album" button |
| User clicks "Create Album" | Dialog opens | Name + description fields; on submit, album appears in list |
| User clicks an album | Album detail page opens | Shows all photos in the album |
| User clicks "Share" on an album | Share dialog opens | User picker + role selector (Viewer/Contributor) |
| User selects a family member as Contributor | They confirm | The member appears in the shared-with list with "Contributor" badge |
| User clicks "Revoke" next to a shared member | They confirm | Member removed from access list |
| User navigates to `/family-timeline` | Page loads | Aggregated timeline showing photos from all shared albums |
| Timeline dedup | Same photo appears in 2 albums | Shown once in the timeline |

---

### Story 3.5: Mobile Album UI — Expo Screens

As a **mobile user**,
I want **to view my albums, see shared albums, and browse the family timeline on my phone**,
So that **I can manage and enjoy family photos on the go**.

**Acceptance Criteria:**

| Given | When | Then |
|-------|------|------|
| User opens Albums tab | Screen loads | List of their own albums + albums shared with them, with owner badge |
| User taps an album | Album detail opens | Shows all photos in the album in a grid |
| User taps "Share" on an album they own | Share screen opens | User picker + role selector |
| User opens Family Timeline tab | Screen loads | Aggregated timeline with photographer indicator per photo |
| User has no shared albums | Family Timeline shows | "No shared moments yet" empty state |

<!-- Epics continued below -->
