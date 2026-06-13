# Epic 2 Context: Photo Discovery & AI

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can browse their photos in a fast, reverse-chronological timeline and instantly find specific photos via AI-powered tag search — without manual organization. This epic converts raw uploaded photos into a browsable, searchable library by generating thumbnails asynchronously, running on-device AI classification, and surfacing everything through a polished timeline UI on both web and mobile.

## Stories

- Story 2.1: Photo Thumbnail Pipeline — Sharp + BullMQ
- Story 2.2: AI Auto-Tagging — ONNX Runtime + MobileNet-v3
- Story 2.3: Photo Timeline API + Web UI
- Story 2.4: Tag Search & Filter API + Web UI
- Story 2.5: Mobile Photo Timeline — Expo Screens

## Requirements & Constraints

- Every uploaded photo must be auto-tagged with relevant labels from a defined taxonomy (baby, outdoor, food, group, document, sunset, pet, toy, selfie, screenshot). A photo may receive multiple tags; photos with no recognizable content remain untagged.
- Tags are stored in Chinese (e.g., "宝宝", "户外") via an English-to-Chinese label mapping table, and returned with photo metadata in API responses.
- Typing a partial tag name shows matching auto-suggestions. Selecting a tag filters the timeline to only matching photos.
- A tag browser lists all available tags with photo count, sorted by count descending, for one-tap filtering. Active filters must be clearable with a single action.
- The timeline displays photos reverse-chronologically by capture date (EXIF preferred, upload date fallback), grouped by day with month headers.
- Initial timeline grid must render within 2 seconds; scrolling maintains 60fps with lazy-loaded thumbnails.
- A date picker or quick-scroll control allows jumping to a specific month/year.
- Tags and thumbnails are generated asynchronously after upload — the upload API returns immediately with status `PROCESSING`.
- No cloud APIs for AI classification; all inference runs on the NAS CPU using an open-source model.
- Thumbnails are derived artifacts; original photo files on disk are the source of truth.
- Mobile timeline (Expo) must show first batch within 3 seconds over mobile data via Cloudflare Tunnel.

## Technical Decisions

- **Thumbnail generation**: Sharp (Node.js native) — 320px WebP for grid thumbnails, 1200px JPEG for previews. Stored at `/mnt/pool/.thumbnails/{user}/{YYYY}/{MM}/{id}_grid.webp` and `{id}_preview.jpg`.
- **AI runtime**: ONNX Runtime for Node.js with MobileNet-v3 model (4–15MB, 100–300ms per inference on CPU). No Python sidecar — entire stack stays TypeScript.
- **Job queue**: BullMQ + Redis. Two named queues: `photo-thumbnail` (runs first on upload completion) and `ai-tagging` (runs after thumbnail completes). Jobs are retryable (max 3 retries); exhausted retries set photo status to `FAILED`.
- **Data models**: Dedicated `Photo`, `PhotoTag`, and `Album` Prisma models (already exist from Epic 1). `PhotoTag` has a unique constraint on `[photoId, tag]` to prevent duplicates on re-processing.
- **API pattern**: New `/api/photos` endpoints follow existing NestJS conventions. Photo responses include tag arrays, thumbnail/preview URLs, and status.
- **Module structure**: New `photos/` and `ai-tagging/` backend modules with `controller → service → module` layout. Web gets `PhotosPage.tsx`, `PhotoGrid.tsx`, `PhotoViewer.tsx`, `TagFilter.tsx`. Mobile gets `PhotoTimelineScreen.tsx`, `PhotoDetailScreen.tsx`.
- **Tags**: Persisted in Chinese via a label mapping table (MobileNet EN class → ZH display label). The taxonomy is fixed for MVP; extensible later.

## Cross-Story Dependencies

- **2.1 (Thumbnails) must precede 2.2 (AI Tagging)** — the AI worker consumes the generated 320px WebP thumbnail as its input, not the original full-resolution file. Story 2.1 and 2.2 are already wired as a BullMQ job chain from Story 1.4.
- **2.3 (Web Timeline) depends on 2.1** — the timeline grid renders the 320px WebP thumbnails and the photo viewer uses 1200px JPEG previews.
- **2.4 (Tag Search) depends on 2.2** — tag search/filter queries `PhotoTag` records created by the AI worker.
- **2.5 (Mobile Timeline) depends on 2.1 and 2.3** — reuses the same API endpoints and thumbnail paths from 2.3; no separate mobile API.
