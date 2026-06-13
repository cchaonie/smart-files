---
title: 'Story 3.3: Family Timeline API'
type: 'feature'
created: '2026-06-13'
status: 'in-progress'
baseline_commit: '4985352'
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users have photos scattered across multiple albums (their own + albums shared with them). There is no unified view that combines all accessible photos into a single timeline sorted by capture date.

**Approach:** Create a new endpoint GET /api/family-timeline that aggregates photos from all albums the user can access, deduplicates by hash, and returns them sorted by capturedAt DESC with cursor-based pagination.

## Boundaries & Constraints

**Always:**
- GET `/api/family-timeline` — Returns photos from ALL albums the user can access: their own albums + albums shared with them (SharedAlbum entries).
- Response shape: same as GET /api/photos — cursor-based pagination: `{ photos: [...], nextCursor, total }`.
- Dedup by hash: use a Set to track hashes, skip photos whose hash has already been included.
- Photos sorted by capturedAt DESC NULLS LAST, createdAt DESC.
- Include tags in response.
- Ownership/access: only photos in accessible albums. Access = owner of album OR has SharedAlbum entry for it.
- Cursor-based pagination: `?cursor=<photoId>&limit=<number>`. Default limit 20, max 100.
- Empty state: returns `{ photos: [], nextCursor: null, total: 0 }`.
- Backend uses strictNullChecks: false.

**Never:**
- No new Prisma models or migrations.
- No changes to web or mobile frontends.
- No changes to auth or user module.

## Tasks

- [x] `_bmad-output/implementation-artifacts/spec-3-3-family-timeline-api.md` — Write this spec file
- [ ] `src/albums/family-timeline.controller.ts` — Create dedicated controller at `/api/family-timeline`
- [ ] `src/albums/family-timeline.service.ts` — Create service with aggregation, dedup, and pagination logic
- [ ] `src/albums/albums.module.ts` — Register FamilyTimelineController and FamilyTimelineService

Verification: `cd packages/backend && npx tsc --noEmit` — zero errors.
