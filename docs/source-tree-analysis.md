# Smart Files - Source Tree Analysis

**Date:** 2026-06-12

## Overview

This project follows a **monorepo** structure using **npm workspaces**. All application code lives under `packages/`. Build artifacts and dependencies are gitignored. The project has evolved from a file manager into a photo hub with async processing.

## Complete Directory Tree

```
smart-files/                                      # Project root
│
├── packages/                                     # Monorepo workspace packages
│   │
│   ├── backend/                                  # 🖥️ NestJS API Server
│   │   ├── src/
│   │   │   ├── main.ts                           # ★ Entry point — bootstrap NestJS
│   │   │   ├── app.module.ts                     # Root module (imports all feature modules)
│   │   │   ├── auth/                             # JWT authentication
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── strategies/                   # passport strategies
│   │   │   ├── files/                            # File CRUD + download/preview/trash
│   │   │   │   ├── files.module.ts
│   │   │   │   ├── files.controller.ts
│   │   │   │   └── files.service.ts
│   │   │   ├── folders/                          # Hierarchical folder management
│   │   │   │   ├── folders.module.ts
│   │   │   │   ├── folders.controller.ts
│   │   │   │   └── folders.service.ts
│   │   │   ├── upload/                           # Chunked upload sessions
│   │   │   │   ├── upload.module.ts
│   │   │   │   ├── upload.controller.ts
│   │   │   │   └── upload.service.ts
│   │   │   ├── share/                            # Public file sharing
│   │   │   │   ├── share.module.ts
│   │   │   │   ├── share.controller.ts
│   │   │   │   └── share.service.ts
│   │   │   ├── photos/                           # 📸 Photo hub (NEW)
│   │   │   │   ├── photos.module.ts              #   + BullMQ queues
│   │   │   │   ├── photos.controller.ts          #   POST /api/photos/upload
│   │   │   │   ├── photos.service.ts             #   Upload + dedup + queue dispatch
│   │   │   │   ├── thumbnail.service.ts          #   Sharp thumbnail generation
│   │   │   │   └── photo-thumbnail.worker.ts     #   BullMQ worker (planned)
│   │   │   ├── prisma/                           # Prisma database service
│   │   │   │   └── prisma.service.ts
│   │   │   ├── redis/                            # Redis connection service
│   │   │   │   └── redis.service.ts
│   │   │   └── common/                           # Shared guards & decorators
│   │   │       ├── guards/
│   │   │       │   └── jwt.guard.ts              #   JwtAuthGuard
│   │   │       └── decorators/
│   │   │           └── current-user.decorator.ts #   @CurrentUser()
│   │   ├── test/                                 # E2E tests
│   │   │   └── app.e2e-spec.ts
│   │   ├── tsconfig.json                         # strictNullChecks: false
│   │   ├── .eslintrc.cjs
│   │   └── package.json
│   │
│   ├── web/                                      # 🌐 React SPA
│   │   ├── src/
│   │   │   ├── main.tsx                          # ★ Entry point
│   │   │   ├── App.tsx                           # Root component
│   │   │   ├── pages/                            # Route pages
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   ├── FilesPage.tsx
│   │   │   │   ├── HomePage.tsx
│   │   │   │   └── SharePage.tsx
│   │   │   ├── components/                       # Reusable UI
│   │   │   │   ├── ShareModal.tsx
│   │   │   │   ├── MoveFileModal.tsx
│   │   │   │   └── MediaPreview.tsx
│   │   │   ├── context/                          # Global state
│   │   │   │   └── AuthContext.tsx
│   │   │   ├── api/                              # API client
│   │   │   │   └── index.ts
│   │   │   └── styles/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── mobile/                                   # 📱 Expo React Native
│   │   ├── src/
│   │   │   ├── screens/                          # Screen components
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   ├── RegisterScreen.tsx
│   │   │   │   ├── ServerConfigScreen.tsx
│   │   │   │   ├── FilesScreen.tsx              # File browser tab
│   │   │   │   ├── UploadsScreen.tsx             # Upload queue tab
│   │   │   │   ├── SettingsScreen.tsx            # Server URL config
│   │   │   │   └── PhotoUploadScreen.tsx         # Photo upload progress
│   │   │   ├── components/                       # Reusable UI
│   │   │   │   ├── PhotoUploadPrompt.tsx
│   │   │   │   ├── BottomTabs.tsx
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   └── icons.tsx                     # 22 SVG icons
│   │   │   ├── hooks/                            # Custom hooks
│   │   │   │   ├── usePhotoDetection.ts          # Camera roll scanner
│   │   │   │   └── usePhotoUpload.ts             # Batch upload
│   │   │   ├── context/                          # Global state
│   │   │   │   ├── AuthContext.tsx
│   │   │   │   ├── ConfigContext.tsx
│   │   │   │   └── PhotoUploadContext.tsx        # Upload state + cleanup
│   │   │   ├── api/                              # API client
│   │   │   │   └── photos.ts                     # XHR upload with progress
│   │   │   └── theme/                            # Design system
│   │   │       └── index.ts                      # Cobalt blue theme tokens
│   │   ├── App.tsx                               # ★ Entry — Tab+Stack navigation
│   │   ├── app.json                              # Expo config
│   │   ├── tsconfig.json                         # strict: true
│   │   └── package.json
│   │
│   └── shared/                                   # 📦 Prisma + shared types
│       ├── prisma/
│       │   ├── schema.prisma                     # ★ Database schema (10 models)
│       │   └── migrations/                       # Database migrations
│       │       └── 20260612_add_photo_domain/    # Photo models migration
│       └── types/
│           └── index.ts                          # Shared TS interfaces
│
├── scripts/
│   └── deploy-api.sh                             # ★ Production deploy script
│
├── _bmad-output/                                 # BMAD planning artifacts
│   ├── planning-artifacts/
│   │   ├── prd/                                  # Product Requirements Doc
│   │   ├── architecture.md                       # Architecture decisions
│   │   └── epics.md                              # Epic breakdown (17 stories)
│   ├── implementation-artifacts/                 # Story implementation docs
│   └── project-context.md                        # AI agent rules
│
├── docs/                                         # Project documentation
│   ├── DEV.md                                    # Development setup (legacy Podman)
│   ├── DEPLOY.md                                 # Deployment guide (legacy Podman)
│   ├── plans/                                    # Feature plans (01-06)
│   ├── project-overview.md                       # ★ This document
│   ├── source-tree-analysis.md                   # ★ This document
│   └── project-scan-report.json                  # Workflow state file
│
├── data/ (gitignored)                            # Runtime data
│   ├── postgres/                                 # PostgreSQL data files
│   └── storage/                                  # Uploaded files
│
├── .env (gitignored)                             # Environment config
├── .gitignore
├── package.json                                  # ★ Root workspace config
└── ecosystem.config.js                           # PM2 config
```

## Critical Folders Summary

| Directory | Purpose | Priority |
|-----------|---------|----------|
| `packages/backend/src/photos/` | Photo upload, dedup, thumbnail pipeline | 🔴 Core |
| `packages/backend/src/common/` | JwtAuthGuard, @CurrentUser decorator | 🔴 Core |
| `packages/backend/src/redis/` | Redis service (fail-fast, shared connection) | 🔴 Core |
| `packages/shared/prisma/` | Database schema + migrations | 🔴 Core |
| `packages/mobile/src/hooks/` | Photo detection & upload hooks | 🟡 Secondary |
| `packages/mobile/src/context/` | Auth, Config, PhotoUpload contexts | 🟡 Secondary |
| `packages/mobile/src/theme/` | Design system tokens | 🟡 Secondary |
| `scripts/` | Production deploy automation | 🟡 Secondary |
| `_bmad-output/` | Planning & architecture artifacts | 🟢 Reference |
| `docs/` | Project documentation | 🟢 Reference |

## Integration Points

```
Backend (:4000) ←──── /api proxy (Vite) ──── Web (:3000)
     ↑
     │ http (Cloudflare Tunnel / LAN)
     ↓
Mobile (Expo)   ──── POST /api/photos/upload ────▶ Backend
                   ──── GET /api/photos/timeline ──▶ Backend

Backend ── BullMQ ──▶ photo-thumbnail worker (Sharp)
Backend ── BullMQ ──▶ ai-tagging worker (ONNX)

Backend ── Prisma ──▶ PostgreSQL
Backend ── filesystem ──▶ /mnt/pool/ (mergerfs)
```

---

_Generated using BMAD Method `document-project` workflow_
