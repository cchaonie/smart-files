---
title: 'Story 3.1: Album CRUD API'
type: 'feature'
created: '2026-06-13'
status: 'done'
baseline_commit: 'ad2ad54'
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users cannot organize photos into albums — no create, list, edit, or delete functionality exists. Every photo lives only in the timeline.

**Approach:** New NestJS `AlbumsModule` with full CRUD: POST/GET /api/albums, GET/PATCH/DELETE /api/albums/:id. Album model already exists in Prisma. No new migrations.

## Boundaries & Constraints

**Always:**
- New module: `packages/backend/src/albums/` — albums.controller.ts, albums.service.ts, albums.module.ts
- POST `/api/albums` — body `{ name: string, description?: string }`. Returns `{ id, name, description, createdAt }`. Owner set to current user.
- GET `/api/albums` — returns `{ albums: Album[] }` — only the current user's own albums (personal library, FR-14). Sorted by createdAt DESC.
- GET `/api/albums/:id` — returns album detail including member count. Ownership check: only owner can view.
- PATCH `/api/albums/:id` — body `{ name?: string, description?: string }`. Ownership check required. Returns updated album.
- DELETE `/api/albums/:id` — only if album has zero photos (AlbumPhotoMember count = 0). Ownership check. Returns 204.
- Album response shape: `{ id, name, description, coverPhotoId, photoCount, createdAt, updatedAt }`
- All routes under `@UseGuards(JwtAuthGuard)`.
- Pattern matches existing modules: imports PrismaModule, registers controller + service.
- Backend uses `strictNullChecks: false`.

**Never:**
- No new Prisma models or migrations (Album, AlbumPhotoMember, SharedAlbum already exist)
- No photo add/remove from albums (Story 3.2 handles this)
- No sharing or role logic (Story 3.2)
- No changes to existing PhotosModule or web/mobile frontends
- No cover photo URL resolution (optional field, stored as photo ID)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create album | POST with { name: "Trip" } | Album created, owner = current user | 400 if name missing |
| List albums | GET /api/albums | All user's albums, newest first | Empty array if none |
| View album detail | GET /api/albums/:id | Album with photoCount | 404 if not found or not owner |
| Update album name | PATCH with { name: "New" } | Name updated | 404 if not found/owner |
| Delete empty album | DELETE /api/albums/:id | Album removed, 204 | 404 if not found/owner |
| Delete album with photos | DELETE on non-empty album | 409 Conflict — "Album has photos" | N/A |
| View another user's album | GET /api/albums/:otherId | 404 Not Found | Ownership hidden |
| Create with empty name | POST with { name: "" } | 400 Bad Request | N/A |

</frozen-after-approval>

## Code Map

- `packages/backend/src/albums/albums.module.ts` — NEW: imports PrismaModule, registers controller + service
- `packages/backend/src/albums/albums.controller.ts` — NEW: CRUD routes
- `packages/backend/src/albums/albums.service.ts` — NEW: business logic
- `packages/backend/src/app.module.ts` — import AlbumsModule

## Tasks & Acceptance

- [ ] `packages/backend/src/albums/albums.module.ts` — NEW
- [ ] `packages/backend/src/albums/albums.controller.ts` — NEW
- [ ] `packages/backend/src/albums/albums.service.ts` — NEW
- [ ] `packages/backend/src/app.module.ts` — import AlbumsModule

Acceptance criteria as defined above.

## Verification

- `cd /home/chrisnie/Code/smart-files/packages/backend && npx tsc --noEmit` — zero errors
