# Epic 3 Context: Family Album & Sharing

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can organize photos into albums, collaborate with family members via shared albums with viewer/contributor roles, and see a unified family timeline combining everyone's shared photos.

## Stories

- Story 3.1: Album CRUD API
- Story 3.2: Album Sharing API
- Story 3.3: Family Timeline API
- Story 3.4: Web Album UI
- Story 3.5: Mobile Album UI — Expo Screens

## Requirements & Constraints

- Personal library private by default (FR-14)
- Albums are owned by a single user; other users access via sharing
- Two sharing roles: VIEWER (read-only) and CONTRIBUTOR (can add photos but not manage the album)
- Family timeline deduplicates by photo hash (FR-16)
- Album cover photo is optional; falls back to most recent photo
- No public albums — all album access requires authentication
- Admin invites family via shareable link (FR-13) — out of scope for v1; manual user creation for now

## Technical Decisions

- **Album module**: New `albums/` NestJS module with controller → service → module layout
- **Sharing**: SharedAlbum model links user → album with role string ('VIEWER' | 'CONTRIBUTOR')
- **Album photos**: AlbumPhotoMember join table with addedById audit trail
- **Family timeline**: Aggregated from photos in all albums the user can access (own + shared), deduped by hash
- **API pattern**: RESTful `/api/albums` endpoints following existing NestJS conventions
- **Web UI**: `/albums` page with album list, album detail, share dialog, family timeline at `/family-timeline`
- **No new Prisma models or migrations** — Album, AlbumPhotoMember, SharedAlbum already exist from Story 1.2

## Cross-Story Dependencies

- **3.1 (Album CRUD) must precede all others** — 3.2, 3.3, 3.4, 3.5 depend on album data
- **3.2 (Sharing) must precede 3.3 and 3.4** — family timeline needs shared album data; web share UI needs the API
- **3.3 (Family Timeline) can run in parallel with 3.2** — depends only on Album/AlbumPhotoMember models
- **3.4 (Web UI) depends on 3.1, 3.2, 3.3** — all APIs must exist
- **3.5 (Mobile UI) depends on 3.1, 3.2, 3.3, 3.4** — reuses APIs plus web patterns
