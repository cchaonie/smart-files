---
title: 'Story 3.4: Web Album UI'
type: 'feature'
created: '2026-06-13'
status: 'in-progress'
baseline_commit: '1df7697'
context: ['_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Albums exist via API but users have no web UI to manage them — no create, browse, share, or family timeline.

**Approach:** New web pages: AlbumsPage (list + create), AlbumDetailPage (photos + share), FamilyTimelinePage. Add Albums tab to BottomTabs. New API module for albums.

## Boundaries & Constraints

**Always:**
- AlbumsPage at `/albums` route under AppLayout — lists user's albums with `Create Album` button
- Album cards show: name, description, photo count, created date
- Create Album dialog: name (required) + description (optional)
- AlbumDetailPage at `/albums/:id` — shows album info + photo grid (same 3-col grid as PhotosPage)
- Share button on AlbumDetailPage → opens share dialog with user search + role selector (Viewer/Contributor)
- Share dialog lists current shares with revoke button
- FamilyTimelinePage at `/family-timeline` — same infinite scroll as PhotosPage but calls `/api/family-timeline`
- No BottomTabs for family timeline — accessible from Albums page header
- All routes under AppLayout
- Match existing web patterns: Tailwind, motion/react, i18n, data fetching via apiClient
- Web uses strict: true

**Never:**
- No backend changes
- No mobile changes
- No changes to PhotosPage or existing photo components

## Tasks

- [ ] `packages/web/src/api/albums.ts` — NEW: albumsApi (list, getById, create, update, delete, share, unshare, listShares, addPhoto, removePhoto, listAlbumPhotos)
- [ ] `packages/web/src/types/index.ts` — ADD Album, ShareEntry types
- [ ] `packages/web/src/pages/AlbumsPage.tsx` — NEW: album list + create dialog
- [ ] `packages/web/src/pages/AlbumDetailPage.tsx` — NEW: album photos + share dialog
- [ ] `packages/web/src/pages/FamilyTimelinePage.tsx` — NEW: aggregated family timeline (copies PhotosPage pattern, calls /api/family-timeline)
- [ ] `packages/web/src/components/icons.tsx` — ADD AlbumsIcon SVG (album/collection)
- [ ] `packages/web/src/components/BottomTabs.tsx` — ADD Albums tab (replacing or extending tabs)
- [ ] `packages/web/src/App.tsx` — ADD /albums, /albums/:id, /family-timeline routes
- [ ] `packages/shared/src/i18n/` — ADD album/family i18n keys

Verification: `cd packages/web && npx tsc --noEmit` — zero errors.
