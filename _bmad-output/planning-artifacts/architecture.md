---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd-smart-files-2026-06-11/prd.md (Smart Files → Home NAS PRD)
workflowType: 'architecture'
project_name: 'smart-files'
user_name: 'Chris'
date: '2026-06-11'
lastStep: 8
status: 'complete'
completedAt: '2026-06-11'
---

# Architecture Decision Document: Smart Files → Home NAS (Photo Hub)

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**17 Functional Requirements** organized into **5 clusters**:

| Cluster | FRs | Core Purpose |
|---------|-----|-------------|
| 📸 Mobile Photo Upload | FR-1 ~ FR-6 | Detect, upload, cleanup from Android |
| 🤖 AI Classification | FR-7 ~ FR-9 | Auto-tag + tag search/filter |
| 🕐 Timeline & Browsing | FR-10 ~ FR-12 | Photo timeline, grid, quick scroll |
| 👨‍👩‍👧 Multi-User & Family Sharing | FR-13 ~ FR-16 | Private libraries + shared albums |
| 🌐 Remote Access | FR-17 | Configurable server URL |

**12 NFRs** across Security, Performance, Storage Architecture, and Reliability.

### Key Architectural Challenges

1. **🧠 AI model selection** — CPU-friendly open-source image classifier (MobileNet / EfficientNet-Lite) running on home NAS without GPU
2. **⚡ Async job queue** — Decouple photo processing (thumbnail gen + AI tagging) from upload
3. **💾 Pooled USB storage** — mergerfs pooling multiple external drives with `{user}/{YYYY}/{MM}/` folder structure
4. **📱 Android background upload** — Foreground service + WorkManager; dedicated photo upload endpoint
5. **🔐 Multi-user isolation** — Private personal libraries with album-level permissions
6. **🛠️ New NestJS modules** — PhotoModule, AlbumModule, AITagModule (greenfield additions)

### Scale Assessment

| Dimension | Assessment |
|-----------|-----------|
| Complexity | Medium — focused scope (photos only), but spans mobile + web + backend + ML |
| Primary domain | Full-stack: Android app + NestJS API + React Web + ML pipeline |
- Cross-cutting concerns: Storage pooling, async processing, multi-user privacy, AI inference on CPU

## Starter Template Evaluation

### Existing Stack (Brownfield — No New Starter Needed)

| Layer | Technology | Status |
|-------|-----------|--------|
| Backend | NestJS 11.x + TypeScript | ✅ In place |
| Web frontend | Vite + React + Tailwind CSS | ✅ In place |
| Mobile | Expo / React Native 0.81 | ✅ In place (adapt for photo features) |
| Database | PostgreSQL 16 + Prisma 7.x | ✅ In place |
| Auth | JWT (passport-jwt) | ✅ Direct reuse |
| Upload | Chunked upload infrastructure | ✅ Extend for photos |
| Deployment | Podman + Nginx + Cloudflare Tunnel | ✅ Direct reuse |

### New Technology Recommendations

| Decision | Recommended | Rationale |
|----------|------------|-----------|
| Thumbnail generation | **Sharp** (Node.js) | Node-native, fast WebP output, no extra runtime |
| Job queue | **BullMQ** + Redis | First-class NestJS support via `@nestjs/bullmq` |
| Storage pooling | **mergerfs** | Mature, apt-installable, hot-swap capable |
| AI ML runtime | **ONNX Runtime for Node.js** | Keeps stack in TypeScript, avoids Python sidecar complexity |
| AI model | **MobileNet-v3** (via ONNX) | 4-15MB, 100-300ms/image on CPU, supports tag taxonomy |

## Core Architectural Decisions

### Data Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Photo data models | **Dedicated** (Photo, Album, PhotoTag, SharedAlbum, PhotoAlbumMember) | Independent from existing File/Folder models; optimal for timeline queries and cross-user album sharing |

### Processing Pipeline

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pipeline mode | **Async via BullMQ + Redis** | Upload returns instantly; thumbnail gen, AI tagging, EXIF extraction run as separate retryable jobs |
| Thumbnails | **Sharp** — 320px WebP grid + 1200px JPEG preview | Node-native, fast, supports WebP output |
| AI runtime | **ONNX Runtime for Node.js** | Keeps entire stack in TypeScript; avoids Python sidecar |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Container strategy | **Remove Podman** — backend via PM2 (already done), Redis via `apt`, PostgreSQL stays in Podman for now | Simplify deployment; single machine doesn't benefit from container overhead |
| Redis | `apt install redis-server`, systemd service | Lightweight (~2MB idle); needed for BullMQ queue |

### Storage Architecture

| Decision | Choice |
|----------|--------|
| Pooling tool | **mergerfs** at `/mnt/pool` |
| Folder structure | `{pool}/{username}/{YYYY}/{MM}/` |
| Hot-swap drives | mergerfs supports adding/removing USB drives without data migration |

### Android App

| Decision | Choice |
|----------|--------|
| Approach | **Extend existing Expo app** — add photo features to current React Native codebase |

### Multi-User Permissions

| Decision | Choice |
|----------|--------|
| Personal library | Strictly private by default |
| Album roles | **Viewer** (read-only) / **Contributor** (can add own photos) via `PhotoAlbumMember` join table |

## Implementation Patterns & Consistency Rules

### Inherited from Existing Codebase
| Pattern | Convention |
|---------|-----------|
| Files | `kebab-case.ts` (modules), `PascalCase.tsx` (components) |
| Classes | `PascalCase` (NestJS services/controllers) |
| Functions | `camelCase` |
| Constants | `UPPER_SNAKE_CASE` (env), `camelCase` (code) |
| Database tables | `PascalCase` (Prisma convention) |
| API style | REST with NestJS decorators, `/api/*` prefix |
| Error handling | NestJS exception filters (`HttpException`) |
| Auth | JWT via `@nestjs/passport`, `@CurrentUser` decorator |

### New Photo Hub Patterns

| Area | Pattern | Example |
|------|---------|---------|
| API endpoints | `/api/photos`, `/api/albums`, `/api/albums/:id/members` | Follows existing `/api/files` convention |
| Module structure | `controller → service → module` with `dto/` and `entities/` subdirs | Same as existing modules |
| Job queue naming | `{domain}-{action}` | `photo-thumbnail`, `ai-tagging`, `exif-extraction` |
| Upload response | Returns `{ id, status: "processing" }` immediately | Async pipeline, client polls for status |
| Error format | `{ message, statusCode, error }` | Keep existing NestJS convention |

## Project Structure & Boundaries

### Backend — New Modules
```
packages/backend/src/
├── photos/                      # NEW — Photo upload/management
│   ├── photos.controller.ts
│   ├── photos.service.ts
│   ├── photos.module.ts
│   ├── dto/
│   │   ├── upload-photo.dto.ts
│   │   └── photo-query.dto.ts
├── albums/                      # NEW — Album management
│   ├── albums.controller.ts
│   ├── albums.service.ts
│   ├── albums.module.ts
│   ├── dto/
│   │   ├── create-album.dto.ts
│   │   ├── share-album.dto.ts
│   │   └── album-query.dto.ts
├── ai-tagging/                  # NEW — AI processing workers
│   ├── ai-tagging.processor.ts  # BullMQ consumer
│   ├── ai-tagging.module.ts
│   ├── classifiers/
│   │   └── mobilenet.classifier.ts
│   ├── thumbnail.processor.ts   # Sharp worker
│   └── exif.processor.ts        # EXIF extraction worker
└── (existing modules: auth/, files/, folders/, upload/, share/)
```

### Web — New Pages & Components
```
packages/web/src/
├── pages/
│   ├── PhotosPage.tsx           # NEW — Photo timeline
│   ├── AlbumsPage.tsx           # NEW — Album list
│   └── AlbumDetailPage.tsx      # NEW — Single album view
├── components/
│   ├── PhotoGrid.tsx            # NEW
│   ├── PhotoViewer.tsx          # NEW
│   ├── TagFilter.tsx            # NEW — Tag browser/filter
│   ├── AlbumCard.tsx            # NEW
│   └── UploadPrompt.tsx         # NEW
├── api/
│   ├── photos.ts                # NEW
│   └── albums.ts                # NEW
└── (existing pages/components remain)
```

### Mobile (Expo) — New Screens
```
packages/mobile/src/
├── screens/
│   ├── PhotoTimelineScreen.tsx  # NEW
│   ├── PhotoDetailScreen.tsx    # NEW
│   ├── AlbumListScreen.tsx      # NEW
│   └── AlbumDetailScreen.tsx    # NEW
├── components/
│   ├── PhotoGrid.tsx            # NEW
│   ├── PhotoUploadBanner.tsx    # NEW
│   └── PhotoViewer.tsx          # NEW
├── api/
│   ├── photos.ts                # NEW
│   └── albums.ts                # NEW
├── services/
│   ├── photoSync.ts             # NEW — Background upload
│   └── cameraRoll.ts            # NEW — Gallery detection
└── (existing screens/components remain)
```

### Shared (Prisma) — New Models
- `schema.prisma` — EXTEND with Photo, Album, PhotoTag, SharedAlbum, PhotoAlbumMember
- `migrations/` — NEW photo domain migrations

### Infrastructure — New System Services
- Redis via `apt install redis-server` (systemd service)
- mergerfs config at `/etc/mergerfs.conf` or fstab entry

## Architecture Validation Results

### Coherence Validation ✅

| Check | Result |
|-------|--------|
| Decision Compatibility | All technology choices work together: NestJS + BullMQ + Redis + Sharp + ONNX Runtime are all Node.js-native |
| Version Compatibility | NestJS 11.x, Prisma 7.x, React 19 — all compatible with existing stack |
| Pattern Consistency | Naming conventions, module structure, and API patterns consistent with existing codebase |
| Structure Alignment | New modules slot cleanly alongside existing ones without restructuring |

### Requirements Coverage ✅

| Requirement Cluster | FRs | Architecture Coverage |
|--------------------|-----|----------------------|
| 📸 Mobile Photo Upload | FR-1 ~ FR-6 | `PhotoModule`, `photoSync.ts` service, camera roll detection, upload endpoint |
| 🤖 AI Classification | FR-7 ~ FR-9 | `AITagModule`, MobileNet classifier via ONNX, BullMQ `ai-tagging` queue |
| 🕐 Timeline & Browsing | FR-10 ~ FR-12 | `PhotosPage`, `PhotoGrid`, quick scroll — web + mobile components |
| 👨‍👩‍👧 Multi-User & Family | FR-13 ~ FR-16 | `AlbumsModule`, `PhotoAlbumMember` join table, viewer/contributor roles |
| 🌐 Remote Access | FR-17 | Cloudflare Tunnel already configured ✅ |
| **12 NFRs** | Security, Performance, Storage, Reliability | All addressed in architecture decisions ✅ |

### Implementation Readiness ✅

| Check | Result |
|-------|--------|
| Decision Completeness | All critical decisions documented with explicit choices |
| Structure Completeness | Complete directory trees defined for backend, web, mobile, shared |
| Pattern Completeness | Naming, structure, communication, and process patterns documented |

### Architecture Completeness Checklist

| Item | Status |
|------|--------|
| Project context analyzed | ✅ |
| Scale and complexity assessed | ✅ |
| Technical constraints identified | ✅ |
| Cross-cutting concerns mapped | ✅ |
| Critical decisions documented | ✅ |
| Technology stack fully specified | ✅ |
| Integration patterns defined | ✅ |
| Performance considerations addressed | ✅ |
| Naming conventions established | ✅ |
| Structure patterns defined | ✅ |
| Communication patterns specified | ✅ |
| Process patterns documented | ✅ |
| Complete directory structure defined | ✅ |
| Component boundaries established | ✅ |
| Integration points mapped | ✅ |
| Requirements to structure mapping complete | ✅ |

### Gap Analysis

| Priority | Gap | Status |
|----------|-----|--------|
| 🟢 Minor | ONNX Runtime Node.js package version — to be resolved during implementation | Deferred to dev |
| 🟢 Minor | Specific Expo native module versions for camera roll access | Deferred to dev |
| 🟢 Minor | mergerfs fstab configuration specifics (depends on USB drive UUIDs) | Deferred to setup |

### Architecture Readiness Assessment

**Overall Status:** ✅ **READY FOR IMPLEMENTATION**
**Confidence Level:** High — all 16 checklist items confirmed, no critical gaps

**Key Strengths:**
- Leverages existing Smart Files infrastructure (auth, upload, JWT, i18n)
- TypeScript throughout — no polyglot complexity (no Python sidecar)
- Async processing via battle-tested BullMQ + Redis
- Clean module separation — existing file manager unaffected
