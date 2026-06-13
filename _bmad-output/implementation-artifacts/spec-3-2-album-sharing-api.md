---
title: 'Story 3.2: Album Sharing API'
type: 'feature'
created: '2026-06-13'
status: 'done'
baseline_commit: 'bb24628'
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Albums exist but cannot be shared with family members. Users can't invite others as viewers (read-only) or contributors (can add photos), and can't add/remove photos from albums.

**Approach:** Extend AlbumsModule with share management (share/unshare) and photo membership (add/remove photos), with role-based access control.

## Boundaries & Constraints

**Always:**
- POST `/api/albums/:id/share` — body `{ userId, role }` where role is `'VIEWER'` or `'CONTRIBUTOR'`. Owner only. Returns `{ id, albumId, userId, role }`.
- DELETE `/api/albums/:id/share/:userId` — Remove access. Owner only. 204.
- GET `/api/albums/:id/shares` — List all users with access to an album. Owner only. Returns `{ shares: { userId, userName, role }[] }`.
- POST `/api/albums/:id/photos` — body `{ photoId: string }`. Owner or CONTRIBUTOR can add. Returns `{ id, albumId, photoId }`.
- DELETE `/api/albums/:id/photos/:photoId` — Owner or CONTRIBUTOR can remove. 204. Or get 403 if VIEWER tries.
- GET `/api/albums/:id/photos` — Any user with access (owner, viewer, contributor) can list. Returns `{ photos: Photo[] }`.
- SharedAlbum model uses `role: String` ('VIEWER' | 'CONTRIBUTOR'), `@@unique([albumId, userId])`.
- Ownership check: album.ownerId === userId.
- Viewer check: role === 'VIEWER' in SharedAlbum.
- Contributor check: role === 'CONTRIBUTOR' in SharedAlbum.
- Backend uses strictNullChecks: false.
- All routes under @UseGuards(JwtAuthGuard).

**Never:**
- No new Prisma models or migrations.
- No changes to auth or user module.
- No changes to web or mobile frontends.

## Tasks

- [ ] `src/albums/albums.service.ts` — ADD share/unshare/listShares, addPhoto/removePhoto/listAlbumPhotos methods
- [ ] `src/albums/albums.controller.ts` — ADD share/unshare/listShares, addPhoto/removePhoto/listAlbumPhotos endpoints

Verification: `cd packages/backend && npx tsc --noEmit` — zero errors.
